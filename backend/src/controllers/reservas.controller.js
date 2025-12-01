// src/controllers/reservas.controller.js
import { pool } from "../config/database.js";
import dayjs from "dayjs";

/**
 * Utilidad: verifica si el rango [desde, hasta) choca con alguna reserva
 * no cancelada de la misma habitación.
 */
const rangoChoca = async (client, habitacionId, desde, hasta) => {
  const q = `
    SELECT 1
    FROM reservas
    WHERE habitacion_id = $1
      AND estado <> 'cancelada'
      AND daterange(fecha_inicio, fecha_fin, '[)') && daterange($2, $3, '[)')
    LIMIT 1
  `;
  const { rows } = await client.query(q, [habitacionId, desde, hasta]);
  return rows.length > 0;
};

/**
 * GET /api/reservas
 * Lista general de reservas (para pantallas tipo listado).
 */
export const listarReservas = async (_req, res) => {
  try {
    const q = `
      SELECT r.*,
             h.numero AS habitacion_numero,
             h.tipo   AS habitacion_tipo,
             COALESCE(hu.nombre, '') AS huesped_nombre
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      ORDER BY r.fecha_inicio DESC, r.id DESC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error("listarReservas error:", e);
    res.status(500).json({ message: "Error al listar reservas." });
  }
};

/**
 * GET /api/reservas/:id
 */
export const obtenerReserva = async (req, res) => {
  const { id } = req.params;
  try {
    const q = `
      SELECT r.*,
             h.numero AS habitacion_numero,
             h.tipo   AS habitacion_tipo,
             COALESCE(hu.nombre, '') AS huesped_nombre,
             hu.documento,
             hu.telefono
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ message: "Reserva no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerReserva error:", e);
    res.status(500).json({ message: "Error al obtener la reserva." });
  }
};

/**
 * GET /api/reservas/calendario
 * Datos para el calendario del rack.
 */
export const getCalendarioReservas = async (_req, res) => {
  try {
    const q = `
      SELECT r.id,
             r.fecha_inicio,
             r.fecha_fin,
             r.estado,
             h.numero AS habitacion_numero,
             COALESCE(hu.nombre, '—') AS huesped_nombre
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      ORDER BY r.fecha_inicio ASC, h.numero ASC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error("getCalendarioReservas error:", e);
    res.status(500).json({ message: "Error al obtener reservas para el calendario." });
  }
};

// Alias por si en alguna parte del código usabas este nombre antiguo.
export const obtenerReservasCalendario = getCalendarioReservas;

/**
 * POST /api/reservas
 * Crea una reserva o un walk-in según el campo "tipo".
 *
 * Body esperado:
 * {
 *   tipo: "reserva" | "walkin",
 *   habitacion_numero: "101",
 *   fecha_inicio: "2025-11-10",
 *   fecha_fin: "2025-11-12",
 *   huesped_nombre: "Juan Perez",
 *   huesped_documento?: "123",
 *   huesped_telefono?: "555..."
 * }
 */
export const crearReservaOWalkIn = async (req, res) => {
  const {
    tipo, // "reserva" | "walkin"
    habitacion_numero,
    fecha_inicio,
    fecha_fin,
    huesped_nombre,
    huesped_documento = null,
    huesped_telefono = null,
  } = req.body;

  if (!tipo || !habitacion_numero || !fecha_inicio || !fecha_fin || !huesped_nombre) {
    return res.status(400).json({ message: "Datos incompletos." });
  }

  const desde = dayjs(fecha_inicio).format("YYYY-MM-DD");
  const hasta = dayjs(fecha_fin).format("YYYY-MM-DD");

  if (
    !dayjs(desde).isValid() ||
    !dayjs(hasta).isValid() ||
    !dayjs(hasta).isAfter(desde)
  ) {
    return res.status(400).json({ message: "Rango de fechas inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Buscar habitación por número
    const hq = await client.query(
      "SELECT id FROM habitaciones WHERE numero = $1 LIMIT 1",
      [habitacion_numero]
    );
    if (!hq.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Habitación no existe." });
    }
    const habitacionId = hq.rows[0].id;

    // Validar choque de rangos
    const choca = await rangoChoca(client, habitacionId, desde, hasta);
    if (choca) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "La habitación ya tiene una reserva u ocupación en ese rango.",
      });
    }

    // Buscar o crear huésped
    let huespedId = null;
    if (huesped_documento) {
      const { rows } = await client.query(
        "SELECT id FROM huespedes WHERE documento = $1 LIMIT 1",
        [huesped_documento]
      );
      if (rows.length) huespedId = rows[0].id;
    }
    if (!huespedId) {
      const ins = await client.query(
        "INSERT INTO huespedes (nombre, documento, telefono) VALUES ($1, $2, $3) RETURNING id",
        [huesped_nombre, huesped_documento, huesped_telefono]
      );
      huespedId = ins.rows[0].id;
    }

    // Estado inicial
    let estado = "reservada";
    let checkin_at = null;

    if (tipo === "walkin") {
      // Validar que sea el día operativo (fecha_sistema)
      const cfg = await client.query(
        "SELECT valor FROM config WHERE clave = 'fecha_sistema' LIMIT 1"
      );
      const fechaSistema =
        cfg.rows?.[0]?.valor || dayjs().format("YYYY-MM-DD");

      if (fechaSistema !== desde) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:
            "El Walk-In solo se permite para el día operativo actual del sistema.",
        });
      }

      estado = "ocupada";
      checkin_at = dayjs().toDate();
    }

    const insR = await client.query(
      `INSERT INTO reservas
         (fecha_inicio, fecha_fin, estado, notas,
          huesped_id, habitacion_id, checkin_at, checkout_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [desde, hasta, estado, null, huespedId, habitacionId, checkin_at, null]
    );

    await client.query("COMMIT");
    res.status(201).json({ id: insR.rows[0].id, estado });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("crearReservaOWalkIn error:", e);
    res.status(500).json({ message: "Error interno al crear la reserva." });
  } finally {
    client.release();
  }
};

// Alias para código viejo que aún llame a crearReserva
export const crearReserva = crearReservaOWalkIn;

/**
 * PUT /api/reservas/:id
 * Actualiza fechas / estado / notas de una reserva.
 * (NO se usa para check-in/check-out; eso tiene endpoints propios).
 */
export const actualizarReserva = async (req, res) => {
  const { id } = req.params;
  const { fecha_inicio, fecha_fin, estado, notas } = req.body;

  try {
    const desde = fecha_inicio
      ? dayjs(fecha_inicio).format("YYYY-MM-DD")
      : null;
    const hasta = fecha_fin ? dayjs(fecha_fin).format("YYYY-MM-DD") : null;

    const q = `
      UPDATE reservas
      SET fecha_inicio = COALESCE($1, fecha_inicio),
          fecha_fin    = COALESCE($2, fecha_fin),
          estado       = COALESCE($3, estado),
          notas        = COALESCE($4, notas),
          updated_at   = NOW()
      WHERE id = $5
      RETURNING *
    `;
    const { rows } = await pool.query(q, [desde, hasta, estado, notas, id]);
    if (!rows.length) return res.status(404).json({ message: "Reserva no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarReserva error:", e);
    res.status(500).json({ message: "Error al actualizar la reserva." });
  }
};

/**
 * DELETE /api/reservas/:id
 * Lógicamente la marcamos como cancelada.
 */
export const cancelarReserva = async (req, res) => {
  const { id } = req.params;
  try {
    const q = `
      UPDATE reservas
      SET estado = 'cancelada',
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ message: "Reserva no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("cancelarReserva error:", e);
    res.status(500).json({ message: "Error al cancelar la reserva." });
  }
};

/**
 * POST /api/reservas/:id/checkin
 */
export const checkinReserva = async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT fecha_inicio, fecha_fin, estado, habitacion_id FROM reservas WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    const reserva = rows[0];

    if (reserva.estado === "cancelada") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La reserva está cancelada." });
    }

    // validar fecha_sistema ∈ [fecha_inicio, fecha_fin)
    const cfg = await client.query(
      "SELECT valor FROM config WHERE clave = 'fecha_sistema' LIMIT 1"
    );
    const fechaSistema =
      cfg.rows?.[0]?.valor || dayjs().format("YYYY-MM-DD");

    const hoy = dayjs(fechaSistema);
    if (
      hoy.isBefore(dayjs(reserva.fecha_inicio), "day") ||
      !hoy.isBefore(dayjs(reserva.fecha_fin), "day") // debe ser < fecha_fin
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "El check-in solo se puede realizar dentro del rango de la reserva.",
      });
    }

    const upd = await client.query(
      `UPDATE reservas
       SET estado = 'ocupada',
           checkin_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query("COMMIT");
    res.json(upd.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("checkinReserva error:", e);
    res.status(500).json({ message: "Error al hacer check-in." });
  } finally {
    client.release();
  }
};

/**
 * POST /api/reservas/:id/checkout
 */
export const checkoutReserva = async (req, res) => {
  const { id } = req.params;

  try {
    const q = `
      UPDATE reservas
      SET estado = 'finalizada',
          checkout_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ message: "Reserva no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("checkoutReserva error:", e);
    res.status(500).json({ message: "Error al hacer check-out." });
  }
};

/**
 * GET /api/reservas/:id/checkin/data
 * (Si lo usas para mostrar datos en el modal de check-in.)
 */
export const obtenerDatosCheckIn = async (req, res) => {
  const { id } = req.params;
  try {
    const q = `
      SELECT r.id,
             r.fecha_inicio,
             r.fecha_fin,
             r.estado,
             h.numero AS habitacion_numero,
             COALESCE(hu.nombre, '') AS huesped_nombre,
             hu.documento,
             hu.telefono
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ message: "Reserva no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerDatosCheckIn error:", e);
    res.status(500).json({ message: "Error al obtener datos de check-in." });
  }
};