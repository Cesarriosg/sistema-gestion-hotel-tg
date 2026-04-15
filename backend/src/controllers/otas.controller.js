// src/controllers/otas.controller.js
// RF-15: webhook entrante (Channex → PMS)
// RF-16: bloquear disponibilidad en Channex al crear reserva
// RF-17: liberar disponibilidad en Channex al cancelar reserva

import { pool } from "../config/database.js";
import dayjs from "dayjs";
import axios from "axios";
import {
  channexBloquearDisponibilidad,
  channexLiberarDisponibilidad,
} from "../services/channex_sync.js";

const CHANNEX_BASE = process.env.CHANNEX_API_URL || "https://staging.channex.io/api/v1";
const CHANNEX_KEY  = () => (process.env.CHANNEX_API_KEY || "").trim();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────
const getOtaConfig = async (client, ota_canal) => {
  const r = await client.query(
    `SELECT ota_canal, activa, habitaciones_incluidas, planes_incluidos
     FROM ota_config WHERE ota_canal = $1 LIMIT 1`,
    [ota_canal]
  );
  if (r.rows.length) return r.rows[0];
  const ins = await client.query(
    `INSERT INTO ota_config (ota_canal, activa, habitaciones_incluidas, planes_incluidos, created_at, updated_at)
     VALUES ($1, TRUE, NULL, NULL, NOW(), NOW())
     RETURNING ota_canal, activa, habitaciones_incluidas, planes_incluidos`,
    [ota_canal]
  );
  return ins.rows[0];
};

const jsonArrayIncludes = (arrJson, value) => {
  if (!arrJson) return true;
  const arr = Array.isArray(arrJson) ? arrJson : [];
  return arr.map(String).includes(String(value));
};

// ─────────────────────────────────────────────────────────────────────────────
// 1) WEBHOOK ENTRANTE — Channex → PMS  (RF-15)
//    POST /api/otas/channex/webhook
// ─────────────────────────────────────────────────────────────────────────────
export const channexWebhook = async (req, res) => {
  // Channex exige 200 inmediato para no reintentar
  res.sendStatus(200);

  try {
    console.log("📥 Channex webhook recibido:", JSON.stringify(req.body, null, 2));

    const booking_revision_id =
      req.body?.booking_revision_id ||
      req.body?.payload?.booking_revision_id;

    const p = req.body?.payload || req.body || {};
    const ota_reserva_id = p.booking_unique_id || p.ota_code || p.booking_id || booking_revision_id;

    if (!ota_reserva_id) {
      console.warn("⚠️  Webhook sin ota_reserva_id — ignorado");
      return;
    }

    // ── Intentar obtener datos completos desde Channex API ──────────────────
    let bookingDetail = null;
    if (CHANNEX_KEY() && booking_revision_id) {
      try {
        const resp = await axios.get(
          `${CHANNEX_BASE}/booking_revisions/${booking_revision_id}`,
          { headers: { "api-key": CHANNEX_KEY() } }
        );
        bookingDetail = resp.data?.data || null;
        console.log("✅ Detalle Channex obtenido:", bookingDetail?.id);
      } catch (err) {
        console.warn("⚠️  No se pudo obtener detalle Channex (usando payload fallback):", err?.response?.data || err.message);
      }
    }

    // ── Normalizar datos al formato interno ────────────────────────────────
    const bd = bookingDetail?.booking || bookingDetail || {};
    const rooms = bd.rooms || p.rooms || [];
    const room  = rooms[0] || {};

    const fecha_inicio = dayjs(bd.arrival_date   || p.arrival_date).format("YYYY-MM-DD");
    const noches       = Number(bd.nights         || p.count_of_nights || 1);
    const fecha_fin    = bd.departure_date
      ? dayjs(bd.departure_date).format("YYYY-MM-DD")
      : dayjs(fecha_inicio).add(noches, "day").format("YYYY-MM-DD");

    const customer_name = bd.customer?.name || p.customer_name || "Cliente OTA";
    const room_type_code = room.room_type_code || room.room_type_id || "Doble";

    if (!dayjs(fecha_inicio).isValid() || !dayjs(fecha_fin).isValid()) {
      console.warn("⚠️  Fechas inválidas en webhook — ignorado");
      return;
    }

    // ── Guardar en base de datos ────────────────────────────────────────────
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Buscar habitación por room_type_code (número o tipo)
      let habQ = await client.query(
        `SELECT id, numero, tipo FROM habitaciones
         WHERE TRIM(numero) = TRIM($1)
           AND estado NOT IN ('mantenimiento','fuera_servicio')
         LIMIT 1`,
        [room_type_code]
      );

      // Si no encontró por número, buscar por tipo disponible
      if (!habQ.rows.length) {
        habQ = await client.query(
          `SELECT h.id, h.numero, h.tipo
           FROM habitaciones h
           WHERE lower(trim(h.tipo)) = lower(trim($1))
             AND h.estado NOT IN ('mantenimiento','fuera_servicio')
             AND NOT EXISTS (
               SELECT 1 FROM reservas r
               WHERE r.habitacion_id = h.id
                 AND r.estado <> 'cancelada'
                 AND daterange(r.fecha_inicio, r.fecha_fin, '[)') && daterange($2, $3, '[)')
             )
           ORDER BY h.numero ASC LIMIT 1`,
          [room_type_code, fecha_inicio, fecha_fin]
        );
      }

      if (!habQ.rows.length) {
        console.warn("⚠️  No hay habitación disponible para tipo:", room_type_code);
        await client.query("ROLLBACK");
        return;
      }

      const hab = habQ.rows[0];

      // ── Crear o reusar huésped OTA ──────────────────────────────────────
      // Separar nombre y apellido del customer_name (ej: "CESAR OTA" → nombres="CESAR" apellido="OTA")
      const partes         = customer_name.trim().split(/\s+/);
      const nombres_ota    = partes.slice(0, -1).join(" ") || customer_name;
      const apellido_ota   = partes.length > 1 ? partes[partes.length - 1] : "OTA";
      const ota_doc_id     = `OTA-${ota_reserva_id}`;

      // Buscar huésped existente por documento OTA (para idempotencia)
      let huespedId = null;
      const hExist = await client.query(
        `SELECT id FROM huespedes WHERE documento = $1 LIMIT 1`,
        [ota_doc_id]
      );
      if (hExist.rows.length) {
        huespedId = hExist.rows[0].id;
      } else {
        const hIns = await client.query(
          `INSERT INTO huespedes
             (nombre, nombres, primer_apellido, tipo_documento, documento,
              email, telefono, created_at, updated_at)
           VALUES ($1,$2,$3,'OTA',$4,$5,$6,NOW(),NOW())
           RETURNING id`,
          [
            customer_name,
            nombres_ota,
            apellido_ota,
            ota_doc_id,
            p.customer_email || bd.customer?.email || null,
            p.customer_phone || bd.customer?.phone || null,
          ]
        );
        huespedId = hIns.rows[0].id;
      }

      // UPSERT reserva (idempotente por ota_canal + ota_reserva_id)
      const up = await client.query(
        `INSERT INTO reservas
           (fecha_inicio, fecha_fin, estado, notas, huesped_id, habitacion_id, plan,
            origen, ota_canal, ota_reserva_id, ota_payload, last_sync_at, created_at, updated_at,
            fuente)
         VALUES ($1,$2,'reservada',$3,$7,$4,'C1','ota','channex',$5,$6,NOW(),NOW(),NOW(),'channex')
         ON CONFLICT (ota_canal, ota_reserva_id)
         DO UPDATE SET
           fecha_inicio  = EXCLUDED.fecha_inicio,
           fecha_fin     = EXCLUDED.fecha_fin,
           huesped_id    = EXCLUDED.huesped_id,
           habitacion_id = EXCLUDED.habitacion_id,
           ota_payload   = EXCLUDED.ota_payload,
           last_sync_at  = NOW(),
           updated_at    = NOW()
         RETURNING id, estado, habitacion_id`,
        [
          fecha_inicio,
          fecha_fin,
          `Reserva OTA - ${customer_name}`,
          hab.id,
          ota_reserva_id,
          JSON.stringify({ customer_name, booking_revision_id, raw: req.body, bookingDetail }),
          huespedId,
        ]
      );

      const reserva = up.rows[0];

      // Vincular huésped como titular en reserva_huespedes
      await client.query(
        `INSERT INTO reserva_huespedes (reserva_id, huesped_id, rol)
         VALUES ($1, $2, 'titular')
         ON CONFLICT (reserva_id, huesped_id) DO NOTHING`,
        [reserva.id, huespedId]
      );

      // Historial
      await client.query(
        `INSERT INTO reservas_historial (reserva_id, usuario, accion, notas)
         VALUES ($1,'channex','Reserva recibida via webhook OTA',$2)`,
        [reserva.id, `OTA ID: ${ota_reserva_id} | Huésped: ${customer_name} | Hab: ${hab.numero}`]
      );

      await client.query("COMMIT");
      console.log(`✅ Reserva OTA guardada → #${reserva.id} Hab ${hab.numero} (${fecha_inicio}→${fecha_fin})`);

      // Notificar al frontend via Socket.IO
      const emitNotificacion = req.app?.get("emitNotificacion");
      if (emitNotificacion) {
        emitNotificacion(
          "ota_nueva_reserva",
          "Nueva reserva OTA",
          `${customer_name} — Hab ${hab.numero} · ${dayjs(fecha_inicio).format("DD/MM")} → ${dayjs(fecha_fin).format("DD/MM")}`,
          { reserva_id: reserva.id }
        );
      }

    } catch (e) {
      await client.query("ROLLBACK");
      console.error("❌ Error guardando reserva OTA:", e.message);
    } finally {
      client.release();
    }

  } catch (e) {
    console.error("❌ Error webhook Channex:", e.message);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2) SANDBOX UPSERT — para pruebas sin Channex real
//    POST /api/otas/sandbox/reserva
// ─────────────────────────────────────────────────────────────────────────────
export const otaCrearOActualizarReservaSandbox = async (req, res) => {
  const {
    ota_canal = "sandbox",
    ota_reserva_id,
    habitacion_numero,
    fecha_inicio,
    fecha_fin,
    titular = {},
    plan = "C1",
    notas = null,
    tarifa_snapshot = null,
    payload = null,
  } = req.body || {};

  if (!ota_reserva_id || !habitacion_numero || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({
      message: "Faltan datos: ota_reserva_id, habitacion_numero, fecha_inicio, fecha_fin.",
    });
  }

  const desde = dayjs(fecha_inicio).format("YYYY-MM-DD");
  const hasta  = dayjs(fecha_fin).format("YYYY-MM-DD");

  if (!dayjs(desde).isValid() || !dayjs(hasta).isValid() || !dayjs(hasta).isAfter(desde)) {
    return res.status(400).json({ message: "Rango de fechas inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cfg = await getOtaConfig(client, ota_canal);
    if (!cfg.activa) {
      await client.query("ROLLBACK");
      return res.status(200).json({ message: `IGNORADA: OTA '${ota_canal}' pausada.`, ignored: true });
    }
    if (!jsonArrayIncludes(cfg.habitaciones_incluidas, habitacion_numero)) {
      await client.query("ROLLBACK");
      return res.status(200).json({ message: `IGNORADA: hab ${habitacion_numero} no habilitada.`, ignored: true });
    }
    if (!jsonArrayIncludes(cfg.planes_incluidos, plan)) {
      await client.query("ROLLBACK");
      return res.status(200).json({ message: `IGNORADA: plan '${plan}' no habilitado.`, ignored: true });
    }

    const hq = await client.query(
      "SELECT id, estado, tipo FROM habitaciones WHERE TRIM(numero)=TRIM($1) LIMIT 1",
      [habitacion_numero]
    );
    if (!hq.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Habitación no existe." });
    }
    const hab = hq.rows[0];
    if (["mantenimiento", "fuera_servicio"].includes(hab.estado)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `Habitación en '${hab.estado}'.` });
    }

    const choque = await client.query(
      `SELECT 1 FROM reservas
       WHERE habitacion_id = $1 AND estado <> 'cancelada'
         AND (ota_canal IS DISTINCT FROM $2 OR ota_reserva_id IS DISTINCT FROM $3)
         AND daterange(fecha_inicio, fecha_fin, '[)') && daterange($4, $5, '[)')
       LIMIT 1`,
      [hab.id, ota_canal, ota_reserva_id, desde, hasta]
    );
    if (choque.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Choque de fechas." });
    }

    const otaPayload = payload || { titular, habitacion_numero, plan };

    const up = await client.query(
      `INSERT INTO reservas
         (fecha_inicio, fecha_fin, estado, notas, huesped_id, habitacion_id, plan, tarifa_snapshot,
          origen, ota_canal, ota_reserva_id, ota_payload, last_sync_at, created_at, updated_at, fuente)
       VALUES ($1,$2,'reservada',$3,NULL,$4,$5,$6,'ota',$7,$8,$9,NOW(),NOW(),NOW(),$10)
       ON CONFLICT (ota_canal, ota_reserva_id)
       DO UPDATE SET
         fecha_inicio    = EXCLUDED.fecha_inicio,
         fecha_fin       = EXCLUDED.fecha_fin,
         notas           = EXCLUDED.notas,
         habitacion_id   = EXCLUDED.habitacion_id,
         plan            = EXCLUDED.plan,
         tarifa_snapshot = COALESCE(EXCLUDED.tarifa_snapshot, reservas.tarifa_snapshot),
         ota_payload     = COALESCE(EXCLUDED.ota_payload, reservas.ota_payload),
         last_sync_at    = NOW(),
         updated_at      = NOW()
       RETURNING id, estado, habitacion_id`,
      [desde, hasta, notas, hab.id, plan, tarifa_snapshot, ota_canal, ota_reserva_id, otaPayload, ota_canal]
    );

    const reserva = up.rows[0];

    await client.query(
      `INSERT INTO reservas_historial (reserva_id, usuario, accion, notas)
       VALUES ($1,$2,'Reserva sandbox OTA creada/actualizada',$3)`,
      [reserva.id, ota_canal, `Titular: ${titular.nombre || "N/A"} | Hab: ${habitacion_numero}`]
    );

    await client.query("COMMIT");

    // RF-16: sincronizar hacia Channex (no bloquea la respuesta)
    channexBloquearDisponibilidad({
      habitacion_numero,
      fecha_inicio: desde,
      fecha_fin: hasta,
      reserva_id: reserva.id,
    }).catch(e => console.warn("[RF-16] Sync no crítico:", e.message));

    return res.status(200).json({ message: "OK", reserva_id: reserva.id, estado: reserva.estado });

  } catch (e) {
    await client.query("ROLLBACK");
    console.error("otaCrearOActualizarReservaSandbox error:", e);
    return res.status(500).json({ message: "Error integrando OTA." });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3) CANCELAR OTA (idempotente)
//    POST /api/otas/sandbox/reserva/cancelar
// ─────────────────────────────────────────────────────────────────────────────
export const otaCancelarReservaSandbox = async (req, res) => {
  const { ota_canal = "sandbox", ota_reserva_id, motivo = "Cancelación OTA" } = req.body || {};

  if (!ota_canal || !ota_reserva_id) {
    return res.status(400).json({ message: "Faltan: ota_canal, ota_reserva_id." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const r = await client.query(
      `SELECT id, estado, habitacion_id,
              fecha_inicio, fecha_fin,
              (SELECT numero FROM habitaciones WHERE id = reservas.habitacion_id) AS hab_numero
       FROM reservas
       WHERE ota_canal = $1 AND ota_reserva_id = $2
       LIMIT 1 FOR UPDATE`,
      [ota_canal, ota_reserva_id]
    );

    if (!r.rows.length) {
      await client.query("ROLLBACK");
      return res.status(200).json({ message: "OK (no existía)", cancelled: false });
    }

    const reserva = r.rows[0];
    if (reserva.estado === "cancelada") {
      await client.query("ROLLBACK");
      return res.status(200).json({ message: "OK (ya cancelada)", cancelled: true });
    }

    await client.query(
      `UPDATE reservas
       SET estado='cancelada',
           notas = COALESCE(notas,'') || $1,
           updated_at=NOW(), last_sync_at=NOW()
       WHERE id = $2`,
      [`\n[OTA] ${motivo}`, reserva.id]
    );

    if (reserva.habitacion_id && reserva.estado === "reservada") {
      await client.query(
        `UPDATE habitaciones SET estado='disponible', updated_at=NOW() WHERE id=$1`,
        [reserva.habitacion_id]
      );
    }

    await client.query(
      `INSERT INTO reservas_historial (reserva_id, usuario, accion, notas)
       VALUES ($1,$2,'Reserva OTA cancelada',$3)`,
      [reserva.id, ota_canal, motivo]
    );

    await client.query("COMMIT");

    // RF-17: liberar disponibilidad en Channex
    if (reserva.hab_numero) {
      channexLiberarDisponibilidad({
        habitacion_numero: reserva.hab_numero,
        fecha_inicio: reserva.fecha_inicio,
        fecha_fin:    reserva.fecha_fin,
        reserva_id:   reserva.id,
      }).catch(e => console.warn("[RF-17] Sync no crítico:", e.message));
    }

    return res.status(200).json({ message: "OK", cancelled: true });

  } catch (e) {
    await client.query("ROLLBACK");
    console.error("otaCancelarReservaSandbox error:", e);
    return res.status(500).json({ message: "Error cancelando OTA." });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4) GET config OTA
// ─────────────────────────────────────────────────────────────────────────────
export const otaGetConfig = async (req, res) => {
  const { ota_canal } = req.params;
  if (!ota_canal) return res.status(400).json({ message: "ota_canal requerido." });
  const client = await pool.connect();
  try {
    const cfg = await getOtaConfig(client, ota_canal);
    return res.json(cfg);
  } catch (e) {
    console.error("otaGetConfig error:", e);
    return res.status(500).json({ message: "Error obteniendo config OTA." });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5) PUT config OTA (activar/pausar + filtros)
// ─────────────────────────────────────────────────────────────────────────────
export const otaUpsertConfig = async (req, res) => {
  const { ota_canal } = req.params;
  const { activa = true, habitaciones_incluidas = null, planes_incluidos = null } = req.body || {};
  if (!ota_canal) return res.status(400).json({ message: "ota_canal requerido." });

  try {
    const q = await pool.query(
      `INSERT INTO ota_config (ota_canal, activa, habitaciones_incluidas, planes_incluidos, created_at, updated_at)
       VALUES ($1,$2,$3,$4,NOW(),NOW())
       ON CONFLICT (ota_canal)
       DO UPDATE SET
         activa = EXCLUDED.activa,
         habitaciones_incluidas = EXCLUDED.habitaciones_incluidas,
         planes_incluidos = EXCLUDED.planes_incluidos,
         updated_at = NOW()
       RETURNING *`,
      [ota_canal, Boolean(activa), habitaciones_incluidas, planes_incluidos]
    );
    return res.json(q.rows[0]);
  } catch (e) {
    console.error("otaUpsertConfig error:", e);
    return res.status(500).json({ message: "Error guardando config OTA." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6) Stats por OTA
// ─────────────────────────────────────────────────────────────────────────────
export const otaStatsReservas = async (req, res) => {
  const { desde, hasta } = req.query;
  const d = desde ? dayjs(desde).format("YYYY-MM-DD") : null;
  const h = hasta  ? dayjs(hasta).format("YYYY-MM-DD")  : null;
  try {
    const q = await pool.query(
      `SELECT COALESCE(ota_canal,'—') AS ota_canal, COUNT(*)::int AS total
       FROM reservas
       WHERE origen = 'ota'
         AND ($1::date IS NULL OR fecha_inicio >= $1)
         AND ($2::date IS NULL OR fecha_inicio <= $2)
       GROUP BY ota_canal ORDER BY total DESC`,
      [d, h]
    );
    return res.json(q.rows || []);
  } catch (e) {
    return res.status(500).json({ message: "Error obteniendo estadísticas OTA." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 7) GET log de sincronizaciones RF-16/17
//    GET /api/otas/sync-log?limit=50
// ─────────────────────────────────────────────────────────────────────────────
export const otaSyncLog = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const q = await pool.query(
      `SELECT id, reserva_id, habitacion_numero, accion, estado, response, created_at
       FROM ota_sync_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.json(q.rows);
  } catch (e) {
    return res.status(500).json({ message: "Error obteniendo sync log." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8) GET propiedades de Channex
//    GET /api/otas/channex/properties
// ─────────────────────────────────────────────────────────────────────────────
export const channexGetProperties = async (_req, res) => {
  if (!CHANNEX_KEY()) return res.status(400).json({ message: "CHANNEX_API_KEY no configurada." });
  try {
    const r = await axios.get(`${CHANNEX_BASE}/properties`, {
      headers: { "user_token": CHANNEX_KEY(), "Content-Type": "application/json" },
      params:  { user_token: CHANNEX_KEY() },
    });
    return res.json(r.data?.data || []);
  } catch (e) {
    return res.status(500).json({ message: "Error consultando Channex.", detail: e?.response?.data || e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 9) GET room types de una propiedad Channex
//    GET /api/otas/channex/room-types?property_id=xxx
// ─────────────────────────────────────────────────────────────────────────────
export const channexGetRoomTypes = async (req, res) => {
  const { property_id } = req.query;
  if (!CHANNEX_KEY()) return res.status(400).json({ message: "CHANNEX_API_KEY no configurada." });
  if (!property_id) return res.status(400).json({ message: "property_id requerido." });
  try {
    const r = await axios.get(`${CHANNEX_BASE}/room_types`, {
      headers: { "user_token": CHANNEX_KEY(), "Content-Type": "application/json" },
      params: { property_id, user_token: CHANNEX_KEY() },
    });
    return res.json(r.data?.data || []);
  } catch (e) {
    return res.status(500).json({ message: "Error consultando Channex.", detail: e?.response?.data || e.message });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 10) GET habitaciones con su mapeo Channex actual
//     GET /api/otas/channex/mapping
// ─────────────────────────────────────────────────────────────────────────────
export const channexGetMapping = async (_req, res) => {
  try {
    const q = await pool.query(
      `SELECT id, numero, tipo, channex_property_id, channex_room_type_id
       FROM habitaciones ORDER BY numero`
    );
    return res.json(q.rows);
  } catch (e) {
    return res.status(500).json({ message: "Error obteniendo mapeo." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 11) PUT mapeo Channex para una habitación
//     PUT /api/otas/channex/mapping/:habitacion_id
// ─────────────────────────────────────────────────────────────────────────────
export const channexSaveMapping = async (req, res) => {
  const { habitacion_id } = req.params;
  const { channex_property_id, channex_room_type_id } = req.body;
  try {
    const q = await pool.query(
      `UPDATE habitaciones
       SET channex_property_id = $1, channex_room_type_id = $2, updated_at = NOW()
       WHERE id = $3 RETURNING id, numero, tipo, channex_property_id, channex_room_type_id`,
      [channex_property_id || null, channex_room_type_id || null, habitacion_id]
    );
    if (!q.rows.length) return res.status(404).json({ message: "Habitación no encontrada." });
    return res.json(q.rows[0]);
  } catch (e) {
    return res.status(500).json({ message: "Error guardando mapeo." });
  }
};