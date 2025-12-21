// src/controllers/pagos.controller.js
import { pool } from "../config/database.js";

/**
 * POST /api/pagos
 * Acepta ambos formatos (frontend y el "otro" controller):
 *  - Front: { reserva_id, tipo, metodo, monto, descripcion }
 *  - Alt:   { reserva_id, tipo, metodo_pago, valor, observaciones }
 *
 * Reglas:
 *  - deposito solo cuando reserva.estado === 'reservada'
 *  - pago solo cuando reserva.estado === 'ocupada'
 */
export const crearPago = async (req, res) => {
  try {
    // Normalizamos body para soportar ambos formatos
    const reserva_id = Number(req.body.reserva_id);

    const tipo = req.body.tipo; // 'deposito' | 'pago'
    const metodo = req.body.metodo || req.body.metodo_pago; // 'efectivo' | ...
    const monto = Number(
      req.body.monto !== undefined ? req.body.monto : req.body.valor
    );

    const referencia =
      req.body.referencia ||
      req.body.descripcion ||
      req.body.observaciones ||
      null;

    if (!reserva_id || Number.isNaN(reserva_id)) {
      return res.status(400).json({ message: "reserva_id inválido." });
    }

    if (!tipo || !metodo || !monto) {
      return res.status(400).json({
        message:
          "Datos incompletos para registrar el pago/deposito (reserva_id, tipo, metodo, monto).",
      });
    }

    if (!["deposito", "pago"].includes(tipo)) {
      return res.status(400).json({ message: "Tipo de movimiento inválido." });
    }

    if (!["efectivo", "tarjeta", "transferencia", "otro"].includes(metodo)) {
      return res.status(400).json({ message: "Método de pago inválido." });
    }

    if (Number.isNaN(monto) || monto <= 0) {
      return res.status(400).json({ message: "El monto debe ser > 0." });
    }

    // Verificar reserva y estado
    const r = await pool.query(
      "SELECT id, estado FROM reservas WHERE id = $1 LIMIT 1",
      [reserva_id]
    );

    if (!r.rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = r.rows[0];

    // Reglas de negocio
    if (tipo === "deposito" && reserva.estado !== "reservada") {
      return res.status(400).json({
        message:
          "Los depósitos solo se pueden registrar mientras la reserva está en estado 'reservada'.",
      });
    }

    if (tipo === "pago" && reserva.estado !== "ocupada") {
      return res.status(400).json({
        message:
          "Los pagos solo se pueden registrar cuando la reserva está 'ocupada' (check-in / walk-in).",
      });
    }

    // Insert con columnas REALES de tu tabla pagos:
    // id, reserva_id, tipo, metodo, monto, referencia, created_at
    const pago = await pool.query(
      `INSERT INTO pagos (reserva_id, tipo, metodo, monto, referencia)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, reserva_id, tipo, metodo, monto, referencia, created_at`,
      [reserva_id, tipo, metodo, monto, referencia]
    );

    return res.status(201).json(pago.rows[0]);
  } catch (e) {
    console.error("crearPago error:", e);
    return res.status(500).json({ message: "Error al registrar el pago/deposito." });
  }
};

/**
 * GET /api/pagos/reserva/:id
 */
export const listarPagosPorReserva = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, reserva_id, tipo, metodo, monto, referencia, created_at
       FROM pagos
       WHERE reserva_id = $1
       ORDER BY created_at ASC`,
      [Number(id)]
    );
    res.json(rows);
  } catch (e) {
    console.error("listarPagosPorReserva error:", e);
    res.status(500).json({ message: "Error al obtener los pagos de la reserva." });
  }
};
