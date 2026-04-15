// src/services/channex_sync.js

import axios from "axios";
import dayjs from "dayjs";
import { pool } from "../config/database.js";

const CHANNEX_BASE = process.env.CHANNEX_API_URL || "https://staging.channex.io/api/v1";
const CHANNEX_KEY  = () => (process.env.CHANNEX_API_KEY || "").trim();

const channexHeaders = () => ({
  "user_token":   CHANNEX_KEY(),
  "Content-Type": "application/json",
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper: obtener property_id y room_type_id de Channex para una habitación
// ─────────────────────────────────────────────────────────────────────────────
const getChannexIds = async (habitacion_numero) => {
  const r = await pool.query(
    `SELECT channex_property_id, channex_room_type_id
     FROM habitaciones
     WHERE TRIM(numero) = TRIM($1)
     LIMIT 1`,
    [habitacion_numero]
  );
  if (!r.rows.length) return null;
  return r.rows[0]; // { channex_property_id, channex_room_type_id }
};


// Bloquear disponibilidad en Channex cuando se crea/confirma reserva

export const channexBloquearDisponibilidad = async ({
  habitacion_numero,
  fecha_inicio,
  fecha_fin,
  reserva_id,
}) => {
  if (!CHANNEX_KEY()) {
    console.warn("[Channex Sync] Sin API key configurada — saltando sync RF-16");
    return { ok: false, reason: "no_api_key" };
  }

  const ids = await getChannexIds(habitacion_numero);
  if (!ids?.channex_room_type_id) {
    console.warn(`[Channex Sync] Hab ${habitacion_numero} sin channex_room_type_id — saltando`);
    return { ok: false, reason: "no_room_type_id" };
  }

  const desde = dayjs(fecha_inicio).format("YYYY-MM-DD");
  const hasta = dayjs(fecha_fin).subtract(1, "day").format("YYYY-MM-DD"); // Channex usa fecha_fin inclusive

  // Channex restrictions API: availability = 0 cierra el cupo
  const body = {
    values: [{
      room_type_id: ids.channex_room_type_id,
      date_from:    desde,
      date_to:      hasta,
      availability: 0,
    }]
  };

  try {
    const resp = await axios.post(
      `${CHANNEX_BASE}/restrictions`,
      body,
      { headers: channexHeaders() }
    );
    console.log(`[Channex Sync RF-16] Disponibilidad bloqueada hab ${habitacion_numero} (${desde}→${hasta}) reserva #${reserva_id}`);
    await _logSync({ reserva_id, habitacion_numero, accion: "bloquear", estado: "ok", response: resp.data });
    return { ok: true, data: resp.data };
  } catch (e) {
    const err = e?.response?.data || e.message;
    console.error(`[Channex Sync RF-16] Error bloqueando disponibilidad:`, err);
    await _logSync({ reserva_id, habitacion_numero, accion: "bloquear", estado: "error", response: err });
    return { ok: false, error: err };
  }
};

//  Liberar disponibilidad en Channex cuando se cancela una reserva

export const channexLiberarDisponibilidad = async ({
  habitacion_numero,
  fecha_inicio,
  fecha_fin,
  reserva_id,
}) => {
  if (!CHANNEX_KEY()) {
    console.warn("[Channex Sync] Sin API key configurada — saltando sync RF-17");
    return { ok: false, reason: "no_api_key" };
  }

  const ids = await getChannexIds(habitacion_numero);
  if (!ids?.channex_room_type_id) {
    console.warn(`[Channex Sync] Hab ${habitacion_numero} sin channex_room_type_id — saltando`);
    return { ok: false, reason: "no_room_type_id" };
  }

  const desde = dayjs(fecha_inicio).format("YYYY-MM-DD");
  const hasta = dayjs(fecha_fin).subtract(1, "day").format("YYYY-MM-DD");

  // availability = 1 reabre el cupo (ajustar según inventario real)
  const body = {
    values: [{
      room_type_id: ids.channex_room_type_id,
      date_from:    desde,
      date_to:      hasta,
      availability: 1,
    }]
  };

  try {
    const resp = await axios.post(
      `${CHANNEX_BASE}/restrictions`,
      body,
      { headers: channexHeaders() }
    );
    console.log(`[Channex Sync RF-17] Disponibilidad liberada hab ${habitacion_numero} (${desde}→${hasta}) reserva #${reserva_id}`);
    await _logSync({ reserva_id, habitacion_numero, accion: "liberar", estado: "ok", response: resp.data });
    return { ok: true, data: resp.data };
  } catch (e) {
    const err = e?.response?.data || e.message;
    console.error(`[Channex Sync RF-17] Error liberando disponibilidad:`, err);
    await _logSync({ reserva_id, habitacion_numero, accion: "liberar", estado: "error", response: err });
    return { ok: false, error: err };
  }
};


// RF-16 variante: Actualizar tarifas en Channex cuando cambia el precio

export const channexActualizarTarifa = async ({
  habitacion_numero,
  fecha_inicio,
  fecha_fin,
  precio_noche,
  plan = "C1",
  reserva_id: _reserva_id = null,
}) => {
  if (!CHANNEX_KEY()) return { ok: false, reason: "no_api_key" };

  const ids = await getChannexIds(habitacion_numero);
  if (!ids?.channex_room_type_id) return { ok: false, reason: "no_room_type_id" };

  const desde = dayjs(fecha_inicio).format("YYYY-MM-DD");
  const hasta  = dayjs(fecha_fin).subtract(1, "day").format("YYYY-MM-DD");

  const body = {
    values: [{
      room_type_id: ids.channex_room_type_id,
      rate_plan_id: plan,
      date_from:    desde,
      date_to:      hasta,
      price:        Number(precio_noche),
    }]
  };

  try {
    const resp = await axios.post(
      `${CHANNEX_BASE}/rates`,
      body,
      { headers: channexHeaders() }
    );
    console.log(`[Channex Sync] Tarifa actualizada hab ${habitacion_numero} $${precio_noche} (${desde}→${hasta})`);
    return { ok: true, data: resp.data };
  } catch (e) {
    const err = e?.response?.data || e.message;
    console.error(`[Channex Sync] Error actualizando tarifa:`, err);
    return { ok: false, error: err };
  }
};

// Log interno de sincronizaciones (tabla ota_sync_log)

const _logSync = async ({ reserva_id, habitacion_numero, accion, estado, response }) => {
  try {
    await pool.query(
      `INSERT INTO ota_sync_log
         (reserva_id, habitacion_numero, accion, estado, response, created_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT DO NOTHING`,
      [reserva_id, habitacion_numero, accion, estado, JSON.stringify(response)]
    );
  } catch (_) {
    // Log no es crítico — no detiene el flujo
  }
};