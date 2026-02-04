// src/controllers/facturacion.controller.js
import { pool } from "../config/database.js";
import dayjs from "dayjs";

/**
 * Busca la tarifa aplicable para UNA fecha:
 * - match por plan + tipo_habitacion
 * - fecha dentro del rango [fecha_inicio, fecha_fin]
 * - si hay varias, prioriza temporada != 'base' (alta/baja/etc)
 */
const getTarifaPorFecha = async (client, { plan, tipoHabitacion, fecha }) => {
  const q = `
    SELECT precio, temporada
    FROM tarifas
    WHERE plan = $1
      AND tipo_habitacion = $2
      AND $3::date BETWEEN fecha_inicio AND fecha_fin
    ORDER BY
      CASE
        WHEN temporada IS NULL THEN 2
        WHEN temporada = 'base' THEN 2
        ELSE 1
      END
    LIMIT 1
  `;
  const r = await client.query(q, [plan, tipoHabitacion, fecha]);
  return r.rows[0] || null;
};

export const calcularTotalAlojamiento = async (client, { plan, tipoHabitacion, fechaInicio, fechaFin }) => {
  const inicio = dayjs(fechaInicio).startOf("day");
  const fin = dayjs(fechaFin).startOf("day");

  if (!fin.isAfter(inicio)) return { total: 0, noches: 0 };

  let total = 0;
  let cursor = inicio.clone();
  let noches = 0;

  while (cursor.isBefore(fin, "day")) {
    const fecha = cursor.format("YYYY-MM-DD");
    const tarifa = await getTarifaPorFecha(client, { plan, tipoHabitacion, fecha });

    if (!tarifa) {
      throw new Error(
        `No hay tarifa configurada para plan='${plan}', tipo='${tipoHabitacion}', fecha='${fecha}'.`
      );
    }

    total += Number(tarifa.precio);
    noches += 1;
    cursor = cursor.add(1, "day");
  }

  return { total, noches };
};




/**
 * GET /api/facturacion/facturas
 * Opcionalmente filtra por rango de fecha_emision (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD)
 */
export const listarFacturas = async (req, res) => {
  const { desde, hasta } = req.query;

  const params = [];
  let where = "WHERE 1=1";

  if (desde) {
    params.push(desde);
    where += ` AND f.fecha_emision >= $${params.length}`;
  }
  if (hasta) {
    params.push(hasta);
    where += ` AND f.fecha_emision <= $${params.length}`;
  }

  try {
    const q = `
      SELECT
        f.id,
        f.reserva_id,
        f.fecha_emision,
        f.total,
        f.estado,
        r.fecha_inicio,
        r.fecha_fin,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(hu.nombre, '') AS huesped_nombre
      FROM facturas f
      JOIN reservas r       ON r.id = f.reserva_id
      JOIN habitaciones h   ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      ${where}
      ORDER BY f.fecha_emision DESC, f.id DESC
    `;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) {
    console.error("listarFacturas error:", e);
    res.status(500).json({ message: "Error al listar facturas." });
  }
};

/**
 * POST /api/facturacion/reservas/:id/facturar
 * Genera factura para reserva en estado 'ocupada'
 * Requiere al menos un pago/deposito registrado (según tu regla actual)
 */
export const facturarReserva = async (req, res) => {
  const { id } = req.params;
  const reservaId = Number(id);

  if (!reservaId || Number.isNaN(reservaId)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Traer reserva + habitación + plan
    const r = await client.query(
      `
      SELECT
        r.id,
        r.fecha_inicio,
        r.fecha_fin,
        r.estado,
        r.facturada,
        r.plan,
        r.habitacion_id,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [reservaId]
    );

    if (!r.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = r.rows[0];

    // 2) Solo facturar si está ocupada
    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Solo se puede facturar una reserva que esté actualmente ocupada (ya hizo check-in).",
      });
    }

    if (reserva.facturada) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La reserva ya tiene una factura generada." });
    }

    // 3) No duplicar factura
    const fExist = await client.query(
      "SELECT id FROM facturas WHERE reserva_id = $1 LIMIT 1",
      [reservaId]
    );
    if (fExist.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La reserva ya tiene una factura generada." });
    }

    // 4) Debe tener al menos un pago/deposito (según tu regla actual)
    const pagosRes = await client.query(
      `SELECT COALESCE(SUM(monto),0) AS total_pagado
       FROM pagos
       WHERE reserva_id = $1`,
      [reservaId]
    );
    const totalPagado = Number(pagosRes.rows?.[0]?.total_pagado || 0);

    if (totalPagado <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Registra al menos un depósito/pago antes de facturar.",
      });
    }

    // 5) Calcular alojamiento por tarifas (noche a noche)
    const plan = (reserva.plan || "C1").trim();
    const tipoHabitacion = reserva.habitacion_tipo;

    const { total: totalAlojamiento, noches } = await calcularTotalAlojamiento(client, {
      plan,
      tipoHabitacion,
      fechaInicio: reserva.fecha_inicio,
      fechaFin: reserva.fecha_fin,
    });

    // 6) Total factura (por ahora: solo alojamiento)
    // (Luego, cargos adicionales se agregarán como líneas y se actualizará facturas.total)
    const totalFactura = Number(totalAlojamiento);

    // 7) Crear factura
    const insF = await client.query(
      `
      INSERT INTO facturas (reserva_id, numero, fecha_emision, total, estado, created_at, updated_at)
      VALUES ($1, $2, NOW(), $3, 'emitida', NOW(), NOW())
      RETURNING id, reserva_id, numero, fecha_emision, total, estado
      `,
      [reservaId, `F-${dayjs().format("YYYYMMDD")}-${reservaId}`, totalFactura]
    );
    const factura = insF.rows[0];

    // 8) Insertar detalle: alojamiento
    const nochesFact = Math.max(Number(noches || 0), 1);
    const valorUnitarioProm = nochesFact > 0 ? totalAlojamiento / nochesFact : totalAlojamiento;

    await client.query(
      `
      INSERT INTO factura_detalle (factura_id, descripcion, cantidad, valor_unitario, valor_total)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        factura.id,
        `Alojamiento Hab. ${reserva.habitacion_numero} (${tipoHabitacion}) - Plan ${plan}`,
        nochesFact,
        valorUnitarioProm,
        totalAlojamiento,
      ]
    );

    // 9) Marcar reserva facturada + snapshot
    await client.query(
      `
      UPDATE reservas
      SET facturada = true,
          tarifa_snapshot = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [reservaId, totalAlojamiento]
    );

    await client.query("COMMIT");
    return res.status(201).json({ factura });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("facturarReserva error:", e);
    return res.status(500).json({ message: e.message || "Error al generar la factura." });
  } finally {
    client.release();
  }
};

/**
 * GET /api/facturacion/facturas/:id
 * Detalle completo de la factura (cabecera + detalle) para "Ver / reimprimir".
 */
export const obtenerFactura = async (req, res) => {
  const { id } = req.params;

  try {
    const qCab = `
      SELECT
        f.id,
        f.reserva_id,
        f.fecha_emision,
        f.total,
        f.estado,
        r.fecha_inicio,
        r.fecha_fin,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(hu.nombre, '') AS huesped_nombre
      FROM facturas f
      JOIN reservas r       ON r.id = f.reserva_id
      JOIN habitaciones h   ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE f.id = $1
      LIMIT 1
    `;
    const { rows: cabRows } = await pool.query(qCab, [id]);
    if (!cabRows.length) {
      return res.status(404).json({ message: "Factura no encontrada." });
    }
    const factura = cabRows[0];

    const qDet = `
      SELECT *
      FROM factura_detalle
      WHERE factura_id = $1
      ORDER BY id
    `;
    const { rows: detRows } = await pool.query(qDet, [id]);

    factura.detalle = detRows;
    res.json(factura);
  } catch (e) {
    console.error("obtenerFactura error:", e);
    res.status(500).json({ message: "Error al obtener la factura." });
  }
};

/**
 * GET /api/facturacion/pagos
 * Listado básico de pagos/depositos/cargos para la pestaña "Pagos / depósitos / cargos"
 */
export const listarPagos = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        p.id,
        p.reserva_id,
        p.tipo,
        p.metodo,
        p.monto,
        p.created_at,

        r.id            AS reserva_id,
        r.fecha_inicio,
        r.fecha_fin,

        h.numero        AS habitacion_numero,
        h.tipo          AS habitacion_tipo,

        COALESCE(hu.nombre, '') AS huesped_nombre

      FROM pagos p
      JOIN reservas r       ON r.id = p.reserva_id
      JOIN habitaciones h   ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      ORDER BY p.created_at DESC
    `);

    res.json(rows);
  } catch (e) {
    console.error("listarPagos error:", e);
    res.status(500).json({ message: "Error al listar pagos." });
  }
};


/**
 * POST /api/reservas/:id/pagos
 * Crea un pago/deposito/cargo asociado a una reserva
 */
// POST /api/reservas/:id/pagos
export const registrarPago = async (req, res) => {
  const { id } = req.params;
  const { monto, metodo, tipo, descripcion, referencia, fecha } = req.body;

  if (!monto || !metodo || !tipo) {
    return res.status(400).json({ message: "Datos incompletos para el pago." });
  }

  try {
    const ins = await pool.query(
      `
      INSERT INTO pagos
        (reserva_id, fecha, monto, metodo, tipo, referencia)
      VALUES
        ($1, COALESCE($2::date, NOW()::date), $3, $4, $5, $6)
      RETURNING *
    `,
      [
        id,
        fecha || null,
        monto,
        metodo,
        tipo,
        (referencia || descripcion || null),
      ]
    );

    res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("registrarPago error:", e);
    res.status(500).json({ message: "Error al registrar el pago." });
  }
};


