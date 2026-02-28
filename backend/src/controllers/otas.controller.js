import { pool } from "../config/database.js";
import dayjs from "dayjs";
import axios from "axios";


// Helpers

const getOtaConfig = async (client, ota_canal) => {
  const r = await client.query(
    `SELECT ota_canal, activa, habitaciones_incluidas, planes_incluidos
     FROM ota_config
     WHERE ota_canal = $1
     LIMIT 1`,
    [ota_canal]
  );
  if (r.rows.length) return r.rows[0];

  // si no existe, la creamos por defecto activa
  const ins = await client.query(
    `INSERT INTO ota_config (ota_canal, activa, habitaciones_incluidas, planes_incluidos, created_at, updated_at)
     VALUES ($1, TRUE, NULL, NULL, NOW(), NOW())
     RETURNING ota_canal, activa, habitaciones_incluidas, planes_incluidos`,
    [ota_canal]
  );
  return ins.rows[0];
};

const jsonArrayIncludes = (arrJson, value) => {
  if (!arrJson) return true; // null => sin filtro
  const arr = Array.isArray(arrJson) ? arrJson : [];
  return arr.map(String).includes(String(value));
};


// 1) WEBHOOK SANDBOX UPSERT

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
  const hasta = dayjs(fecha_fin).format("YYYY-MM-DD");

  if (!dayjs(desde).isValid() || !dayjs(hasta).isValid() || !dayjs(hasta).isAfter(desde)) {
    return res.status(400).json({ message: "Rango de fechas inválido." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    //  0) Config OTA: activa/pausada + filtros
    const cfg = await getOtaConfig(client, ota_canal);

    if (!cfg.activa) {
      await client.query("ROLLBACK");
      return res.status(200).json({
        message: `IGNORADA: OTA '${ota_canal}' está pausada.`,
        ignored: true,
      });
    }

    //  Filtrar habitaciones/planes si config los define
    if (!jsonArrayIncludes(cfg.habitaciones_incluidas, habitacion_numero)) {
      await client.query("ROLLBACK");
      return res.status(200).json({
        message: `IGNORADA: habitación ${habitacion_numero} no está habilitada para OTA '${ota_canal}'.`,
        ignored: true,
      });
    }

    if (!jsonArrayIncludes(cfg.planes_incluidos, plan)) {
      await client.query("ROLLBACK");
      return res.status(200).json({
        message: `IGNORADA: plan '${plan}' no está habilitado para OTA '${ota_canal}'.`,
        ignored: true,
      });
    }

    // 1) Buscar habitación
    const hq = await client.query(
      "SELECT id, estado, tipo FROM habitaciones WHERE TRIM(numero)=TRIM($1) LIMIT 1",
      [habitacion_numero]
    );

    if (!hq.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Habitación no existe." });
    }

    const hab = hq.rows[0];

    // No permitir entrar si no es operable
    if (["mantenimiento", "fuera_servicio"].includes(hab.estado)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: `No se puede reservar: habitación en '${hab.estado}'.` });
    }

    // 2) Evitar choque (excluyendo esta misma reserva OTA)
    const choque = await client.query(
      `
      SELECT 1
      FROM reservas
      WHERE habitacion_id = $1
        AND estado <> 'cancelada'
        AND (ota_canal IS DISTINCT FROM $2 OR ota_reserva_id IS DISTINCT FROM $3)
        AND daterange(fecha_inicio, fecha_fin, '[)') && daterange($4, $5, '[)')
      LIMIT 1
      `,
      [hab.id, ota_canal, ota_reserva_id, desde, hasta]
    );

    if (choque.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Choque: la habitación ya tiene una reserva en ese rango." });
    }

    // 3) huésped opcional 
    const huespedId = null;

    const otaPayload = payload || {
      titular,
      habitacion_numero,
      plan,
    };

    // 4) UPSERT idempotente (requiere UNIQUE (ota_canal, ota_reserva_id))
    const up = await client.query(
      `
      INSERT INTO reservas
        (fecha_inicio, fecha_fin, estado, notas, huesped_id, habitacion_id, plan, tarifa_snapshot,
         origen, ota_canal, ota_reserva_id, ota_payload, last_sync_at, created_at, updated_at)
      VALUES
        ($1,$2,'reservada',$3,$4,$5,$6,$7,
         'ota',$8,$9,$10,NOW(),NOW(),NOW())
      ON CONFLICT (ota_canal, ota_reserva_id)
      DO UPDATE SET
        fecha_inicio = EXCLUDED.fecha_inicio,
        fecha_fin    = EXCLUDED.fecha_fin,
        notas        = EXCLUDED.notas,
        habitacion_id= EXCLUDED.habitacion_id,
        plan         = EXCLUDED.plan,
        tarifa_snapshot = COALESCE(EXCLUDED.tarifa_snapshot, reservas.tarifa_snapshot),
        ota_payload  = COALESCE(EXCLUDED.ota_payload, reservas.ota_payload),
        last_sync_at = NOW(),
        updated_at   = NOW()
      RETURNING id, estado, habitacion_id
      `,
      [desde, hasta, notas, huespedId, hab.id, plan, tarifa_snapshot, ota_canal, ota_reserva_id, otaPayload]
    );

    const reserva = up.rows[0];

    // 5) Estado habitación coherente (reservada)
    await client.query(
      `UPDATE habitaciones SET estado='reservada', updated_at=NOW() WHERE id=$1`,
      [reserva.habitacion_id]
    );

    await client.query("COMMIT");
    return res.status(200).json({ message: "OK", reserva_id: reserva.id, estado: reserva.estado });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("otaCrearOActualizarReservaSandbox error:", e);
    return res.status(500).json({ message: "Error integrando OTA (sandbox)." });
  } finally {
    client.release();
  }
};


// 2) CANCELAR OTA (idempotente)

export const otaCancelarReservaSandbox = async (req, res) => {
  const { ota_canal = "sandbox", ota_reserva_id, motivo = "Cancelación OTA" } = req.body || {};

  if (!ota_canal || !ota_reserva_id) {
    return res.status(400).json({ message: "Faltan datos: ota_canal, ota_reserva_id." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const r = await client.query(
      `SELECT id, estado, habitacion_id
       FROM reservas
       WHERE ota_canal = $1 AND ota_reserva_id = $2
       LIMIT 1
       FOR UPDATE`,
      [ota_canal, ota_reserva_id]
    );

    if (!r.rows.length) {
      await client.query("ROLLBACK");
      // idempotente: si no existe, ok
      return res.status(200).json({ message: "OK (no existía)", cancelled: false });
    }

    const reserva = r.rows[0];

    if (reserva.estado === "cancelada") {
      await client.query("ROLLBACK");
      return res.status(200).json({ message: "OK (ya estaba cancelada)", cancelled: true });
    }

    await client.query(
      `UPDATE reservas
       SET estado='cancelada',
           notas = COALESCE(notas,'') || $1,
           updated_at=NOW(),
           last_sync_at=NOW()
       WHERE id = $2`,
      [`\n[OTA] ${motivo}`, reserva.id]
    );

    // liberar habitación si estaba reservada (igual que tu lógica normal)
    if (reserva.habitacion_id && reserva.estado === "reservada") {
      await client.query(
        `UPDATE habitaciones SET estado='disponible', updated_at=NOW() WHERE id=$1`,
        [reserva.habitacion_id]
      );
    }

    await client.query("COMMIT");
    return res.status(200).json({ message: "OK", cancelled: true });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("otaCancelarReservaSandbox error:", e);
    return res.status(500).json({ message: "Error cancelando OTA (sandbox)." });
  } finally {
    client.release();
  }
};


// 3) GET config OTA

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


// 4) PUT config OTA (activar/pausar + filtros)
// body: { activa, habitaciones_incluidas, planes_incluidos }

export const otaUpsertConfig = async (req, res) => {
  const { ota_canal } = req.params;
  const {
    activa = true,
    habitaciones_incluidas = null, // array o null
    planes_incluidos = null,       // array o null
  } = req.body || {};

  if (!ota_canal) return res.status(400).json({ message: "ota_canal requerido." });

  try {
    const q = await pool.query(
      `
      INSERT INTO ota_config (ota_canal, activa, habitaciones_incluidas, planes_incluidos, created_at, updated_at)
      VALUES ($1,$2,$3,$4,NOW(),NOW())
      ON CONFLICT (ota_canal)
      DO UPDATE SET
        activa = EXCLUDED.activa,
        habitaciones_incluidas = EXCLUDED.habitaciones_incluidas,
        planes_incluidos = EXCLUDED.planes_incluidos,
        updated_at = NOW()
      RETURNING *
      `,
      [
        ota_canal,
        Boolean(activa),
        habitaciones_incluidas,
        planes_incluidos,
      ]
    );

    return res.json(q.rows[0]);
  } catch (e) {
    console.error("otaUpsertConfig error:", e);
    return res.status(500).json({ message: "Error guardando config OTA." });
  }
};


// 5) Stats por OTA
// GET /api/otas/stats/reservas?desde&hasta

export const otaStatsReservas = async (req, res) => {
  const { desde, hasta } = req.query;

  const d = desde ? dayjs(desde).format("YYYY-MM-DD") : null;
  const h = hasta ? dayjs(hasta).format("YYYY-MM-DD") : null;

  try {
    const q = await pool.query(
      `
      SELECT
        COALESCE(ota_canal, '—') AS ota_canal,
        COUNT(*)::int AS total
      FROM reservas
      WHERE origen = 'ota'
        AND ($1::date IS NULL OR fecha_inicio >= $1)
        AND ($2::date IS NULL OR fecha_inicio <= $2)
      GROUP BY ota_canal
      ORDER BY total DESC
      `,
      [d, h]
    );

    return res.json(q.rows || []);
  } catch (e) {
    console.error("otaStatsReservas error:", e);
    return res.status(500).json({ message: "Error obteniendo estadísticas OTA." });
  }
};

const buscarHabitacionDisponible = async (client, { tipoHabitacion, desde, hasta }) => {
  const q = `
    SELECT h.id, h.numero, h.tipo
    FROM habitaciones h
    WHERE lower(trim(h.tipo)) = lower(trim($1))
      AND h.estado NOT IN ('mantenimiento','fuera_servicio')
      AND NOT EXISTS (
        SELECT 1
        FROM reservas r
        WHERE r.habitacion_id = h.id
          AND r.estado <> 'cancelada'
          AND daterange(r.fecha_inicio, r.fecha_fin, '[)') && daterange($2, $3, '[)')
      )
    ORDER BY h.numero ASC
    LIMIT 1
  `;
  const { rows } = await client.query(q, [tipoHabitacion, desde, hasta]);
  return rows[0] || null;
};


export const channexWebhook = async (req, res) => {
  //  responde inmediatamente (evita reintentos y headers_sent)
  res.sendStatus(200);

  try {
    console.log("📥 Webhook CHANNEX recibido");
    console.log(JSON.stringify(req.body, null, 2));

    const booking_revision_id =
      req.body?.booking_revision_id ||
      req.body?.payload?.booking_revision_id;

    const p = req.body?.payload || {};
    const ota_reserva_id = p.booking_unique_id || p.ota_code || p.booking_id;

    // Si no hay revision id, igual podemos guardar fallback con payload
    if (!ota_reserva_id || !p.arrival_date) {
      console.warn("⚠️ Webhook sin datos mínimos (ota_reserva_id/arrival_date)");
      return;
    }

    //  FALLBACK: guardar con payload (aunque Channex API falle) 
    const fecha_inicio = dayjs(p.arrival_date).format("YYYY-MM-DD");
    const noches = Number(p.count_of_nights || 1);
    const fecha_fin = dayjs(fecha_inicio).add(noches, "day").format("YYYY-MM-DD");

    const tipoHabitacion = "Doble"; // puedes decidirlo mejor luego
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1) buscar una habitación disponible por tipo (ajusta tipo)
      const habQ = await client.query(
        `
        SELECT h.id, h.numero, h.tipo
        FROM habitaciones h
        WHERE lower(trim(h.tipo)) = lower(trim($1))
          AND h.estado NOT IN ('mantenimiento','fuera_servicio')
          AND NOT EXISTS (
            SELECT 1 FROM reservas r
            WHERE r.habitacion_id = h.id
              AND r.estado <> 'cancelada'
              AND daterange(r.fecha_inicio, r.fecha_fin, '[)') && daterange($2, $3, '[)')
          )
        ORDER BY h.numero ASC
        LIMIT 1
        `,
        [tipoHabitacion, fecha_inicio, fecha_fin]
      );

      if (!habQ.rows.length) {
        console.warn("⚠️ No hay habitación disponible para tipo:", tipoHabitacion);
        await client.query("ROLLBACK");
        return;
      }

      const hab = habQ.rows[0];

      // 2) intentar traer detalle desde Channex (opcional)
      let bookingDetail = null;
      try {
        const CHANNEX_API_KEY = (process.env.CHANNEX_API_KEY || "").trim();
        console.log("🔑 CHANNEX key length:", CHANNEX_API_KEY.length);

        if (CHANNEX_API_KEY && booking_revision_id) {
          const bookingRes = await axios.get(
            `https://staging.channex.io/api/v1/booking_revisions/${booking_revision_id}`,
            { headers: { "api-key": CHANNEX_API_KEY } }
          );
          bookingDetail = bookingRes.data?.data || null;
        }
      } catch (err) {
        console.error("⚠️ No se pudo traer detalle Channex (seguimos con fallback):", err?.response?.data || err.message);
      }

      const customer_name =
        bookingDetail?.booking?.customer?.name ||
        p.customer_name ||
        "Cliente OTA";

      const ota_payload = {
        customer_name,
        webhook: req.body,
        bookingDetail,
      };

      // 3) upsert en reservas
      await client.query(
        `
        INSERT INTO reservas
          (fecha_inicio, fecha_fin, estado, notas, huesped_id, habitacion_id, plan, tarifa_snapshot,
           origen, ota_canal, ota_reserva_id, ota_payload, last_sync_at, created_at, updated_at)
        VALUES
          ($1,$2,'reservada',NULL,NULL,$3,'C1',NULL,
           'ota','channex',$4,$5,NOW(),NOW(),NOW())
        ON CONFLICT (ota_canal, ota_reserva_id)
        DO UPDATE SET
          fecha_inicio = EXCLUDED.fecha_inicio,
          fecha_fin    = EXCLUDED.fecha_fin,
          habitacion_id= EXCLUDED.habitacion_id,
          ota_payload  = EXCLUDED.ota_payload,
          last_sync_at = NOW(),
          updated_at   = NOW()
        `,
        [fecha_inicio, fecha_fin, hab.id, ota_reserva_id, ota_payload]
      );

      await client.query("COMMIT");
      console.log(" Reserva OTA guardada (fallback) -> Hab:", hab.numero);
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("❌ Error guardando reserva OTA:", e.message);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("❌ Error webhook CHANNEX:", e.message);
  }
};



