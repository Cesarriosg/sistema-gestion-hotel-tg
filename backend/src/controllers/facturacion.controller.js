// src/controllers/facturacion.controller.js
import { pool } from "../config/database.js";
import dayjs from "dayjs";

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
 * POST /api/reservas/:id/facturar
 * Genera una factura a partir de una reserva ya finalizada.
 * (Esta función ya la tenías, la dejo simplificada y compatible.)
 */
// controllers/facturacion.controller.js

export const facturarReserva = async (req, res) => {
  const { id } = req.params; // id de la reserva
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Traer la reserva + datos base
    const { rows } = await client.query(
      `
      SELECT
        r.id,
        r.fecha_inicio,
        r.fecha_fin,
        r.estado,
        r.facturada,
        r.habitacion_id,
        r.huesped_id,
        h.tarifa_base,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(hu.nombre, '') AS huesped_nombre
      FROM reservas r
      JOIN habitaciones h    ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rows[0];

    // 🔹 NUEVA REGLA:
    // Solo facturamos reservas que están actualmente ocupadas
    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "Solo se puede facturar una reserva que esté actualmente ocupada (ya hizo check-in).",
      });
    }

    // Si ya está marcada como facturada, no permitir duplicado
    if (reserva.facturada) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "La reserva ya tiene una factura generada." });
    }

    // Verificar que no exista factura previa por seguridad
    const fExist = await client.query(
      "SELECT id FROM facturas WHERE reserva_id = $1 LIMIT 1",
      [id]
    );
    if (fExist.rows.length) {
      await client.query("ROLLBACK");
      return res
        .status(400)
        .json({ message: "La reserva ya tiene una factura generada." });
    }

    // Cálculo de noches
    const noches = dayjs(reserva.fecha_fin).diff(
      dayjs(reserva.fecha_inicio),
      "day"
    );
    const nochesFact = Math.max(noches, 1);
    const valorAlojamiento = (reserva.tarifa_base || 0) * nochesFact;

    // Sumar cargos adicionales registrados como pre-cargos por reserva
    const { rows: cargosRows } = await client.query(
      `
      SELECT
        COALESCE(SUM(valor_total), 0) AS total_cargos
      FROM factura_detalle
      WHERE reserva_id = $1
      `,
      [id]
    );
    const totalCargos = Number(cargosRows[0]?.total_cargos || 0);

    const totalFactura = valorAlojamiento + totalCargos;

    // Insertar factura
    const insF = await client.query(
      `
      INSERT INTO facturas
        (reserva_id, fecha_emision, total, estado, created_at, updated_at)
      VALUES
        ($1, NOW()::date, $2, 'emitida', NOW(), NOW())
      RETURNING id, fecha_emision, total, estado
      `,
      [id, totalFactura]
    );

    const factura = insF.rows[0];

    // Detalle de alojamiento
    await client.query(
      `
      INSERT INTO factura_detalle
        (factura_id, concepto, cantidad, valor_unitario, valor_total, tipo)
      VALUES
        ($1, $2, $3, $4, $5, 'alojamiento')
      `,
      [
        factura.id,
        `Alojamiento Hab. ${reserva.habitacion_numero} (${reserva.habitacion_tipo})`,
        nochesFact,
        reserva.tarifa_base || 0,
        valorAlojamiento,
      ]
    );

    // 🔹 MUY IMPORTANTE:
    // Marcar la reserva como facturada, pero SIN cambiar el estado
    await client.query(
      `
      UPDATE reservas
      SET facturada = true,
          updated_at = NOW()
      WHERE id = $1
      `,
      [id]
    );

    await client.query("COMMIT");

    res.status(201).json({
      id: factura.id,
      reserva_id: id,
      total: factura.total,
      fecha_emision: factura.fecha_emision,
      estado: factura.estado,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("facturarReserva error:", e);
    res.status(500).json({ message: "Error al generar la factura." });
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
export const registrarPago = async (req, res) => {
  const { id } = req.params; // reserva_id
  const { monto, metodo, tipo, descripcion } = req.body;

  if (!monto || !metodo || !tipo) {
    return res.status(400).json({ message: "Datos incompletos para el pago." });
  }

  try {
    const ins = await pool.query(
      `
      INSERT INTO pagos
        (reserva_id, fecha, monto, metodo, tipo, descripcion)
      VALUES
        ($1, NOW()::date, $2, $3, $4, $5)
      RETURNING *
    `,
      [id, monto, metodo, tipo, descripcion || null]
    );
    res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("registrarPago error:", e); 
    res.status(500).json({ message: "Error al registrar el pago." });
  }
};
