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
             hu.telefono,
             hu.email
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length)
      return res.status(404).json({ message: "Reserva no encontrada." });
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
      WHERE r.estado IN ('reservada','ocupada')
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
 *   huesped_telefono?: "555...",
 *   huesped_email?: "correo@..."
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
    huesped_email = null,
    notas = null,
  } = req.body;

   if (!["reserva", "walkin"].includes(tipo)) {
    return res.status(400).json({ message: "Tipo inválido. Use 'reserva' o 'walkin'." });
  }

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
        "INSERT INTO huespedes (nombre, documento, telefono, email) VALUES ($1, $2, $3, $4) RETURNING id",
        [huesped_nombre, huesped_documento, huesped_telefono, huesped_email]
      );
      huespedId = ins.rows[0].id;
    }

    // Estado inicial
    let estado = "reservada";
    let checkin_at = null;

    if (tipo === "walkin") {
      // Validar que sea el día operativo (fecha_sistema)
      const cfg = await client.query(
        "SELECT fecha_sistema FROM configuracion LIMIT 1"
      );
      const fechaSistema = dayjs(
        cfg.rows?.[0]?.fecha_sistema || new Date()
      ).format("YYYY-MM-DD");

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
      [desde, hasta, estado, notas, huespedId, habitacionId, checkin_at, null]
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
 */
export const actualizarReserva = async (req, res) => {
  const { id } = req.params;
  const reservaId = Number(id);

  const {
    fecha_inicio,
    fecha_fin,
    estado,
    notas,
    habitacion_numero, // ✅ opcional: permitir cambiar habitación por número
  } = req.body;

  if (!reservaId || Number.isNaN(reservaId)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Traer reserva actual con lock
    const r0 = await client.query(
      `SELECT id, habitacion_id, fecha_inicio, fecha_fin, estado
       FROM reservas
       WHERE id = $1
       FOR UPDATE`,
      [reservaId]
    );
    if (!r0.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    const actual = r0.rows[0];

    // 2) Resolver nueva habitación (si mandan habitacion_numero)
    let nuevaHabitacionId = actual.habitacion_id;
    if (habitacion_numero) {
      const hq = await client.query(
        "SELECT id FROM habitaciones WHERE numero = $1 LIMIT 1",
        [habitacion_numero]
      );
      if (!hq.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Habitación no existe." });
      }
      nuevaHabitacionId = hq.rows[0].id;
    }

    // 3) Resolver nuevas fechas
    const nuevoDesde = fecha_inicio
      ? dayjs(fecha_inicio).format("YYYY-MM-DD")
      : dayjs(actual.fecha_inicio).format("YYYY-MM-DD");

    const nuevoHasta = fecha_fin
      ? dayjs(fecha_fin).format("YYYY-MM-DD")
      : dayjs(actual.fecha_fin).format("YYYY-MM-DD");

    if (
      !dayjs(nuevoDesde).isValid() ||
      !dayjs(nuevoHasta).isValid() ||
      !dayjs(nuevoHasta).isAfter(nuevoDesde)
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Rango de fechas inválido." });
    }

    // 4) Si cambian fechas/habitación, validar choque excluyendo esta reserva
    const cambiaAlgo =
      nuevaHabitacionId !== actual.habitacion_id ||
      nuevoDesde !== dayjs(actual.fecha_inicio).format("YYYY-MM-DD") ||
      nuevoHasta !== dayjs(actual.fecha_fin).format("YYYY-MM-DD");

    if (cambiaAlgo) {
      const qChoca = `
        SELECT 1
        FROM reservas
        WHERE habitacion_id = $1
          AND id <> $2
          AND estado <> 'cancelada'
          AND daterange(fecha_inicio, fecha_fin, '[)') && daterange($3, $4, '[)')
        LIMIT 1
      `;
      const { rows: choque } = await client.query(qChoca, [
        nuevaHabitacionId,
        reservaId,
        nuevoDesde,
        nuevoHasta,
      ]);
      if (choque.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "La habitación ya tiene una reserva u ocupación en ese rango.",
        });
      }
    }

    // 5) Actualizar
    const upd = await client.query(
      `
      UPDATE reservas
      SET habitacion_id = $1,
          fecha_inicio  = $2,
          fecha_fin     = $3,
          estado        = COALESCE($4, estado),
          notas         = COALESCE($5, notas),
          updated_at    = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [nuevaHabitacionId, nuevoDesde, nuevoHasta, estado, notas, reservaId]
    );

    await client.query("COMMIT");
    return res.json(upd.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("actualizarReserva error:", e);
    return res.status(500).json({ message: "Error al actualizar la reserva." });
  } finally {
    client.release();
  }
};


/**
 * DELETE /api/reservas/:id
 * Lógicamente la marcamos como cancelada.
 */
export const cancelarReserva = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, estado, habitacion_id FROM reservas WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rows[0];

    const upd = await client.query(
      `UPDATE reservas
       SET estado = 'cancelada',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // si estaba reservada (sin ocupar), la habitación vuelve a disponible
    if (reserva.estado === "reservada") {
      await client.query(
        `UPDATE habitaciones
         SET estado = 'disponible', updated_at = NOW()
         WHERE id = $1`,
        [reserva.habitacion_id]
      );
    }

    await client.query("COMMIT");
    res.json(upd.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("cancelarReserva error:", e);
    res.status(500).json({ message: "Error al cancelar la reserva." });
  } finally {
    client.release();
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
      dayjs(cfg.rows?.[0]?.fecha_sistema).format("YYYY-MM-DD") ||
      dayjs().format("YYYY-MM-DD");

    const hoy = dayjs(fechaSistema);
    if (
      hoy.isBefore(dayjs(reserva.fecha_inicio), "day") ||
      !hoy.isBefore(dayjs(reserva.fecha_fin), "day")
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "El check-in solo se puede realizar dentro del rango de la reserva.",
      });
    }

    // actualizar reserva
    const updReserva = await client.query(
      `UPDATE reservas
       SET estado = 'ocupada',
           checkin_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // actualizar estado de la habitación
    await client.query(
      `UPDATE habitaciones
       SET estado = 'ocupada', updated_at = NOW()
       WHERE id = $1`,
      [reserva.habitacion_id]
    );

    await client.query("COMMIT");
    res.json(updReserva.rows[0]);
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
 * Ahora:
 *  - Solo permite checkout si la reserva está 'ocupada'
 *  - Debe existir ya una factura asociada
 *  - Valida fecha_sistema >= fecha_inicio + 1 día
 */


export const checkoutReserva = async (req, res) => {
  const { id } = req.params;
  const reservaId = Number(id);

  if (!reservaId || Number.isNaN(reservaId)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Traer reserva con lock
    const rRes = await client.query(
      `SELECT id, estado, fecha_inicio, fecha_fin
       FROM reservas
       WHERE id = $1
       FOR UPDATE`,
      [reservaId]
    );

    if (!rRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rRes.rows[0];

    // 2) Validar estado
    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Solo se puede hacer check-out de reservas en estado 'ocupada'.",
      });
    }

    // 3) Validación de fecha mínima (opcional, pero útil)
    //    Permite checkout desde el día siguiente al check-in
    try {
      const cfg = await client.query(
        "SELECT fecha_sistema FROM configuracion LIMIT 1"
      );
      const fechaSistema = cfg.rows?.[0]?.fecha_sistema;
      if (fechaSistema) {
        const hoy = dayjs(fechaSistema).startOf("day");
        const minCheckout = dayjs(reserva.fecha_inicio).add(1, "day").startOf("day");
        if (hoy.isBefore(minCheckout)) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message:
              "El check-out solo se permite a partir del día siguiente a la llegada (según la fecha operativa).",
          });
        }
      }
    } catch (_) {
      // si configuracion no existe o algo raro, no bloqueamos el checkout
    }

    // 4) Verificar factura emitida (CLAVE para tu flujo)
    const rFact = await client.query(
      `SELECT id, estado
       FROM facturas
       WHERE reserva_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [reservaId]
    );

    if (!rFact.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "No se puede hacer check-out sin una factura generada.",
      });
    }

    const factura = rFact.rows[0];

    // Si tu columna estado existe (recomendado), validamos emitida
    if (factura.estado && factura.estado !== "emitida") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La factura debe estar en estado 'emitida' para confirmar el check-out.",
      });
    }

    // 5) Hacer checkout
    const upd = await client.query(
      `UPDATE reservas
       SET estado = 'finalizada',
           checkout_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [reservaId]
    );

    await client.query("COMMIT");
    return res.json(upd.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("checkoutReserva error:", e);
    return res.status(500).json({ message: "Error al hacer check-out." });
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
             hu.telefono,
             hu.email
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length)
      return res.status(404).json({ message: "Reserva no encontrada." });
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
 * Devuelve:
 *  - reserva (con datos básicos)
 *  - pagos
 *  - factura
 *  - detalles (líneas de factura)
 *  - resumen (totales)
 */
export const obtenerFinanzasReserva = async (req, res) => {
  const { id } = req.params;

  if (isNaN(id)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  try {
    // 1. Reserva + habitación + huésped
    const rReserva = await pool.query(
      `
      SELECT 
        r.*,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(hu.nombre, '') AS huesped_nombre
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rReserva.rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rReserva.rows[0];

    // 2. Pagos / depósitos
    const rPagos = await pool.query(
      `
      SELECT *
      FROM pagos
      WHERE reserva_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );
    const pagos = rPagos.rows;

    const total_depositos = pagos
      .filter((p) => p.tipo === "deposito")
      .reduce((acc, p) => acc + Number(p.monto), 0);

    const total_pagos = pagos
      .filter((p) => p.tipo === "pago")
      .reduce((acc, p) => acc + Number(p.monto), 0);

    const total_pagado = total_depositos + total_pagos;

    // 3. Factura (si existe)
    const rFactura = await pool.query(
      `
      SELECT *
      FROM facturas
      WHERE reserva_id = $1
      LIMIT 1
      `,
      [id]
    );

    const factura = rFactura.rows[0] || null;

    // 4. Detalles de factura (si hay factura)
    let detalles = [];
    let total_facturado = 0;

    if (factura) {
      const rDet = await pool.query(
        `
        SELECT *
        FROM factura_detalle
        WHERE factura_id = $1
        ORDER BY id ASC
        `,
        [factura.id]
      );
      detalles = rDet.rows;
      total_facturado = Number(factura.total);
    }

    const saldo = total_facturado - total_pagado;

    const resumen = {
      total_depositos,
      total_pagos,
      total_pagado,
      total_facturado,
      saldo,
    };

    res.json({
      reserva,
      pagos,
      factura,
      detalles,
      resumen,
    });
  } catch (e) {
    console.error("obtenerFinanzasReserva error:", e);
    res.status(500).json({ message: "Error al obtener datos financieros." });
  }
};

/**
 * POST /api/reservas/:id/facturar
 * Solo cuando la reserva está 'ocupada' y hay pagos/depositos.
 */
export const facturarReserva = async (req, res) => {
  const { id } = req.params;

  if (isNaN(id)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

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

    // ✅ SOLO se factura cuando está OCUPADA (después del check-in y antes del check-out)
    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "Solo se puede facturar una reserva que está 'ocupada' (después del check-in y antes del check-out).",
      });
    }

    // Verificar que no exista factura previa
    const rFacturaPrev = await client.query(
      "SELECT * FROM facturas WHERE reserva_id = $1 LIMIT 1",
      [id]
    );
    if (rFacturaPrev.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La reserva ya tiene una factura generada.",
      });
    }

    // Pagos/depositos asociados
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
        message:
          "No hay depósitos ni pagos registrados. No se puede generar factura.",
      });
    }

    const total_factura = total_pagado; // por ahora igual al total pagado
    const numero = `F-${dayjs().format("YYYYMMDD")}-${id}`;

    const rFactura = await client.query(
      `INSERT INTO facturas (reserva_id, numero, total)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [id, numero, total_factura]
    );
    const factura = rFactura.rows[0];

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
    res
      .status(500)
      .json({ message: "Error al generar la factura de la reserva." });
  } finally {
    client.release();
  }
};

/**
 * POST /api/reservas/:id/factura/cargos
 * Agrega cargos adicionales a la factura existente.
 * Body: { descripcion, cantidad, valor_unitario }
 */
export const agregarCargoFactura = async (req, res) => {
  const { id } = req.params; // id de la reserva
  const { descripcion, cantidad, valor_unitario } = req.body;

  if (!descripcion || !cantidad || !valor_unitario) {
    return res.status(400).json({
      message: "Descripción, cantidad y valor unitario son obligatorios.",
    });
  }

  const cant = Number(cantidad);
  const vu = Number(valor_unitario);

  if (isNaN(cant) || isNaN(vu) || cant <= 0 || vu < 0) {
    return res.status(400).json({
      message: "Cantidad y valor unitario deben ser numéricos válidos.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Traer reserva y factura
    const rRes = await client.query(
      "SELECT * FROM reservas WHERE id = $1 FOR UPDATE",
      [id]
    );

    if (!rRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rRes.rows[0];

    // Solo permitimos cargos adicionales mientras está OCUPADA
    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "Solo se pueden agregar cargos adicionales cuando la reserva está 'ocupada'.",
      });
    }

    const rFact = await client.query(
      "SELECT * FROM facturas WHERE reserva_id = $1 LIMIT 1 FOR UPDATE",
      [id]
    );

    if (!rFact.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La reserva aún no tiene factura. Genera la factura primero.",
      });
    }

    const factura = rFact.rows[0];

    const valor_total = cant * vu;

    // 2. Insertar línea de detalle
    const rDet = await client.query(
      `
      INSERT INTO factura_detalle
        (factura_id, descripcion, cantidad, valor_unitario, valor_total)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [factura.id, descripcion, cant, vu, valor_total]
    );

    const detalleNuevo = rDet.rows[0];

    // 3. Actualizar total de la factura
    const nuevoTotal = Number(factura.total) + valor_total;

    const rFactUpd = await client.query(
      `
      UPDATE facturas
      SET total = $1
      WHERE id = $2
      RETURNING *
      `,
      [nuevoTotal, factura.id]
    );

    const facturaActualizada = rFactUpd.rows[0];

    await client.query("COMMIT");

    res.status(201).json({
      message: "Cargo adicional agregado correctamente.",
      detalle: detalleNuevo,
      factura: facturaActualizada,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("agregarCargoFactura error:", e);
    res.status(500).json({
      message: "Error al agregar el cargo adicional a la factura.",
    });
  } finally {
    client.release();
  }
};

export const listarHabitacionesDisponibles = async (req, res) => {
  const { desde, hasta, tipo } = req.query;

  if (!desde || !hasta) {
    return res.status(400).json({ message: "Debe enviar desde y hasta." });
  }

  const d = dayjs(desde).format("YYYY-MM-DD");
  const h = dayjs(hasta).format("YYYY-MM-DD");

  if (!dayjs(d).isValid() || !dayjs(h).isValid() || !dayjs(h).isAfter(d)) {
    return res.status(400).json({ message: "Rango de fechas inválido." });
  }

  try {
    const q = `
      SELECT h.id, h.numero, h.tipo, h.tarifa_base, h.estado
      FROM habitaciones h
      WHERE ($3::text IS NULL OR h.tipo = $3)
        AND NOT EXISTS (
          SELECT 1
          FROM reservas r
          WHERE r.habitacion_id = h.id
            AND r.estado <> 'cancelada'
            AND daterange(r.fecha_inicio, r.fecha_fin, '[)') && daterange($1, $2, '[)')
        )
      ORDER BY h.numero ASC
    `;
    const { rows } = await pool.query(q, [d, h, tipo || null]);
    return res.json(rows);
  } catch (e) {
    console.error("listarHabitacionesDisponibles error:", e);
    return res.status(500).json({ message: "Error al consultar disponibilidad." });
  }
};

