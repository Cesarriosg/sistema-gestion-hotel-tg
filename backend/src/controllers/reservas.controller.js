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
    if (!rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
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
      WHERE r.estado IN ('reservada', 'ocupada')
      ORDER BY r.fecha_inicio ASC, h.numero ASC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error("getCalendarioReservas error:", e);
    res
      .status(500)
      .json({ message: "Error al obtener reservas para el calendario." });
  }
};

// Alias por compatibilidad con código viejo
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

  console.log("crearReservaOWalkIn body:", req.body);

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

    // 1. Buscar habitación por número
    const hq = await client.query(
      "SELECT id FROM habitaciones WHERE numero = $1 LIMIT 1",
      [habitacion_numero]
    );
    if (!hq.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Habitación no existe." });
    }
    const habitacionId = hq.rows[0].id;

    // 2. Validar choque de rangos
    const choca = await rangoChoca(client, habitacionId, desde, hasta);
    if (choca) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        message: "La habitación ya tiene una reserva u ocupación en ese rango.",
      });
    }

    // 3. Buscar o crear huésped
    let huespedId = null;

    if (huesped_documento) {
      const { rows } = await client.query(
        "SELECT id FROM huespedes WHERE documento = $1 LIMIT 1",
        [huesped_documento]
      );
      if (rows.length) {
        huespedId = rows[0].id;
      }
    }

    if (!huespedId) {
      const insHu = await client.query(
        "INSERT INTO huespedes (nombre, documento, telefono) VALUES ($1, $2, $3) RETURNING id",
        [huesped_nombre, huesped_documento, huesped_telefono]
      );
      huespedId = insHu.rows[0].id;
    }

    // 4. Estado inicial
    let estado = "reservada";
    let checkin_at = null;

    if (tipo === "walkin") {
      // Validar que sea el día operativo (fecha_sistema)
      const cfg = await client.query(
  "SELECT fecha_sistema FROM configuracion LIMIT 1"
);

const fechaSistema =
  dayjs(cfg.rows?.[0]?.fecha_sistema).format("YYYY-MM-DD");


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

    // 5. Insertar la reserva
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
    if (!rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarReserva error:", e);
    res.status(500).json({ message: "Error al actualizar la reserva." });
  }
};

/**
 * DELETE /api/reservas/:id
 * Lógica: marcar como cancelada.
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
    if (!rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
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
  "SELECT fecha_sistema FROM configuracion LIMIT 1"
);

const fechaSistema =
  dayjs(cfg.rows?.[0]?.fecha_sistema).format("YYYY-MM-DD");

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
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT fecha_inicio, fecha_fin, estado FROM reservas WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rows[0];

    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Solo se puede hacer check-out de reservas ocupadas.",
      });
    }

    // Validar fecha_sistema (opcional pero elegante)
    const cfg = await client.query(
      "SELECT fecha_sistema FROM configuracion LIMIT 1"
    );
    const fechaSistema = dayjs(cfg.rows?.[0]?.fecha_sistema).format(
      "YYYY-MM-DD"
    );
    const hoy = dayjs(fechaSistema);

    // No permitir checkout antes del día siguiente al check-in teórico
    const fechaMinCheckout = dayjs(reserva.fecha_inicio).add(1, "day");
    if (hoy.isBefore(fechaMinCheckout, "day")) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "El check-out solo se puede realizar a partir del día siguiente a la llegada.",
      });
    }

    const upd = await client.query(
      `UPDATE reservas
       SET estado = 'finalizada',
           checkout_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    await client.query("COMMIT");
    res.json(upd.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("checkoutReserva error:", e);
    res.status(500).json({ message: "Error al hacer check-out." });
  } finally {
    client.release();
  }
};


/**
 * GET /api/reservas/:id/checkin/data
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
    if (!rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerDatosCheckIn error:", e);
    res
      .status(500)
      .json({ message: "Error al obtener datos de check-in." });
  }
};

/**
 * GET /api/reservas/:id/finanzas
 * Devuelve reserva + pagos + factura + resumen.
 */
export const obtenerFinanzasReserva = async (req, res) => {
  const { id } = req.params;

  try {
    const rReserva = await pool.query(
      `SELECT r.*,
              h.numero AS habitacion_numero,
              h.tipo   AS habitacion_tipo,
              COALESCE(hu.nombre, '') AS huesped_nombre
       FROM reservas r
       JOIN habitaciones h ON h.id = r.habitacion_id
       LEFT JOIN huespedes hu ON hu.id = r.huesped_id
       WHERE r.id = $1
       LIMIT 1`,
      [id]
    );

    if (!rReserva.rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    const reserva = rReserva.rows[0];

    const rPagos = await pool.query(
      `SELECT *
       FROM pagos
       WHERE reserva_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    const pagos = rPagos.rows;

    const rFactura = await pool.query(
      `SELECT *
       FROM facturas
       WHERE reserva_id = $1
       LIMIT 1`,
      [id]
    );
    const factura = rFactura.rows[0] || null;

    const total_pagado = pagos.reduce(
      (acc, p) => acc + Number(p.monto),
      0
    );

    const total_facturado = factura ? Number(factura.total) : 0;

    res.json({
      reserva,
      pagos,
      factura,
      resumen: {
        total_pagado,
        total_facturado,
        saldo: total_facturado - total_pagado,
      },
    });
  } catch (e) {
    console.error("obtenerFinanzasReserva error:", e);
    res.status(500).json({ message: "Error al obtener finanzas de la reserva." });
  }
};

/**
 * POST /api/reservas/:id/facturar
 * Crea una factura si la reserva está finalizada y tiene pagos.
 */
export const facturarReserva = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const rRes = await client.query(
      "SELECT * FROM reservas WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (!rRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    const reserva = rRes.rows[0];

    if (reserva.estado !== "finalizada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Solo se puede facturar una reserva finalizada (check-out).",
      });
    }

    // Ver si ya tiene factura
    const rFacturaPrev = await client.query(
      "SELECT * FROM facturas WHERE reserva_id = $1 LIMIT 1",
      [id]
    );
    if (rFacturaPrev.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La reserva ya tiene factura." });
    }

    // Pagos asociados
    const rPagos = await client.query(
      "SELECT * FROM pagos WHERE reserva_id = $1",
      [id]
    );
    const pagos = rPagos.rows;
    const total_pagado = pagos.reduce(
      (acc, p) => acc + Number(p.monto),
      0
    );

    if (total_pagado <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "No hay pagos/de depósitos registrados. No se puede facturar.",
      });
    }

    // Por ahora, asumimos que el total de la factura = total pagado
    const total_factura = total_pagado;

    const numero = `F-${dayjs().format("YYYYMMDD")}-${id}`;

    const rFactura = await client.query(
      `INSERT INTO facturas (reserva_id, numero, total)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [id, numero, total_factura]
    );
    const factura = rFactura.rows[0];

    // Detalle básico (alojamiento)
    await client.query(
      `INSERT INTO factura_detalle
        (factura_id, descripcion, cantidad, valor_unitario, valor_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        factura.id,
        "Alojamiento y servicios de la reserva",
        1,
        total_factura,
        total_factura,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({ factura });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("facturarReserva error:", e);
    res.status(500).json({ message: "Error al generar la factura." });
  } finally {
    client.release();
  }
};

