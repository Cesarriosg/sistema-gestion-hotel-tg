import { pool } from "../config/database.js";
import dayjs from "dayjs";

// helper: choque de rangos [inicio, fin)
const rangoChocaCon = async (client, habitacionId, desde, hasta) => {
  // 1) choca con reservas (no cancelada/finalizada)
  const r1 = await client.query(
    `
    SELECT 1
    FROM reservas
    WHERE habitacion_id = $1
      AND estado NOT IN ('cancelada','finalizada')
      AND NOT (fecha_fin <= $2 OR fecha_inicio >= $3)
    LIMIT 1
    `,
    [habitacionId, desde, hasta]
  );
  if (r1.rows.length) return true;

  // 2) choca con otros bloqueos activos
  const r2 = await client.query(
    `
    SELECT 1
    FROM bloqueos
    WHERE habitacion_id = $1
      AND estado = 'activo'
      AND NOT (fecha_fin <= $2 OR fecha_inicio >= $3)
    LIMIT 1
    `,
    [habitacionId, desde, hasta]
  );
  if (r2.rows.length) return true;

  return false;
};

// GET /api/bloqueos/calendario
export const getCalendarioBloqueos = async (req, res) => {
  try {
    const q = await pool.query(`
      SELECT
        b.id,
        b.tipo,
        b.motivo,
        b.fecha_inicio,
        b.fecha_fin,
        h.numero AS habitacion_numero
      FROM bloqueos b
      JOIN habitaciones h ON h.id = b.habitacion_id
      WHERE b.estado = 'activo'
      ORDER BY b.fecha_inicio ASC
    `);

    return res.json(q.rows);
  } catch (e) {
    console.error("getCalendarioBloqueos error:", e);
    return res.status(500).json({ message: e.message || "Error al obtener bloqueos." });
  }
};

// POST /api/bloqueos
export const crearBloqueo = async (req, res) => {
  const { tipo, habitacion_numero, fecha_inicio, fecha_fin, motivo = null } = req.body;

  const tipoOk = String(tipo || "").trim();
  if (!["mantenimiento", "administrativo"].includes(tipoOk)) {
    return res.status(400).json({ message: "Tipo inválido (mantenimiento/administrativo)." });
  }
  if (!habitacion_numero || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ message: "Datos incompletos." });
  }

  const desde = dayjs(fecha_inicio).format("YYYY-MM-DD");
  const hasta = dayjs(fecha_fin).format("YYYY-MM-DD");

  if (!dayjs(desde).isValid() || !dayjs(hasta).isValid() || !dayjs(hasta).isAfter(desde)) {
    return res.status(400).json({ message: "Rango inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const hq = await client.query(
      "SELECT id, estado, tipo FROM habitaciones WHERE numero = $1 LIMIT 1",
      [habitacion_numero]
    );
    if (!hq.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Habitación no existe." });
    }

    const hab = hq.rows[0];

    // ✅ Bloqueo NO permitido si choca con reserva/ocupación o con otro bloqueo
    const choca = await rangoChocaCon(client, hab.id, desde, hasta);
    if (choca) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "La habitación ya tiene reserva/ocupación/bloqueo en ese rango." });
    }

    const ins = await client.query(
      `
      INSERT INTO bloqueos (habitacion_id, tipo, fecha_inicio, fecha_fin, motivo, estado, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,'activo',NOW(),NOW())
      RETURNING id, tipo, motivo, fecha_inicio, fecha_fin
      `,
      [hab.id, tipoOk, desde, hasta, (motivo || "").trim() || null]
    );

    // ✅ (opcional recomendado) si es mantenimiento y HOY está dentro del rango, set estado habitación = mantenimiento
    const cfg = await client.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
    const fechaSistema = dayjs(cfg.rows?.[0]?.fecha_sistema || new Date()).format("YYYY-MM-DD");
    const hoy = dayjs(fechaSistema);

    if (tipoOk === "mantenimiento") {
      if (!hoy.isBefore(dayjs(desde), "day") && hoy.isBefore(dayjs(hasta), "day")) {
        await client.query(
          `UPDATE habitaciones SET estado = 'mantenimiento', updated_at = NOW() WHERE id = $1`,
          [hab.id]
        );
      }
    }

    await client.query("COMMIT");
    return res.status(201).json(ins.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("crearBloqueo error:", e);
    return res.status(500).json({ message: e.message || "Error creando bloqueo." });
  } finally {
    client.release();
  }
};

// DELETE /api/bloqueos/:id  (soft delete)
export const eliminarBloqueo = async (req, res) => {
  const { id } = req.params;

  try {
    const r = await pool.query(
      `UPDATE bloqueos SET estado='eliminado', updated_at=NOW() WHERE id=$1 RETURNING id`,
      [id]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Bloqueo no encontrado." });
    return res.json({ ok: true });
  } catch (e) {
    console.error("eliminarBloqueo error:", e);
    return res.status(500).json({ message: e.message || "Error eliminando bloqueo." });
  }
};
