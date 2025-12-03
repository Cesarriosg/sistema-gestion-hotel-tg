// src/controllers/pagos.controller.js
import { pool } from "../config/database.js";

export const crearPago = async (req, res) => {
  const { reserva_id, tipo, metodo, monto, referencia } = req.body;

  if (!reserva_id || !tipo || !metodo || !monto) {
    return res.status(400).json({ message: "Datos incompletos para el pago." });
  }

  try {
    // Verificar que la reserva exista
    const r = await pool.query(
      "SELECT id, estado FROM reservas WHERE id = $1 LIMIT 1",
      [reserva_id]
    );
    if (!r.rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const pago = await pool.query(
      `INSERT INTO pagos (reserva_id, tipo, metodo, monto, referencia)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [reserva_id, tipo, metodo, monto, referencia || null]
    );

    res.status(201).json(pago.rows[0]);
  } catch (e) {
    console.error("crearPago error:", e);
    res.status(500).json({ message: "Error al registrar el pago." });
  }
};

export const listarPagosPorReserva = async (req, res) => {
  const { id } = req.params; // id de la reserva

  try {
    const { rows } = await pool.query(
      `SELECT *
       FROM pagos
       WHERE reserva_id = $1
       ORDER BY created_at ASC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error("listarPagosPorReserva error:", e);
    res.status(500).json({ message: "Error al obtener los pagos de la reserva." });
  }
};
