// src/controllers/serviciosConsumidos.controller.js
// NOTA: el nombre del archivo es serviciosConsumidos.controller.js
// (con punto, no guion bajo) para coincidir con el import en servicios_routes.js
import { pool } from "../config/database.js";
import dayjs from "dayjs";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/servicios-consumidos/:reservaId
// Lista todos los servicios/cargos manuales de una reserva
// ─────────────────────────────────────────────────────────────────────────────
export const listarConsumos = async (req, res) => {
  const { reservaId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, reserva_id, categoria, descripcion, cantidad, precio_unitario,
              (cantidad * precio_unitario) AS total,
              fecha, created_at
       FROM servicios_consumidos
       WHERE reserva_id = $1
       ORDER BY created_at DESC`,
      [reservaId]
    );
    res.json(rows);
  } catch (e) {
    console.error("listarConsumos error:", e);
    res.status(500).json({ message: "Error al listar servicios consumidos." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/servicios-consumidos
// Registra un nuevo consumo/cargo manual
// ─────────────────────────────────────────────────────────────────────────────
export const registrarConsumo = async (req, res) => {
  const {
    reserva_id,
    categoria = "otro",
    descripcion,
    cantidad = 1,
    precio_unitario,
    fecha,
    // compatibilidad con formato anterior
    servicio_id,
    costo,
  } = req.body;

  if (!reserva_id) {
    return res.status(400).json({ message: "reserva_id es obligatorio." });
  }

  // Soporte para el formato anterior { reserva_id, servicio_id, costo }
  const precioFinal  = precio_unitario ?? costo;
  const descFinal    = descripcion ?? (servicio_id ? `Servicio #${servicio_id}` : null);
  const cantFinal    = Number(cantidad || 1);
  const fechaFinal   = fecha || dayjs().format("YYYY-MM-DD");

  if (!descFinal || !descFinal.trim()) {
    return res.status(400).json({ message: "La descripcion del servicio es obligatoria." });
  }
  if (!precioFinal || Number(precioFinal) <= 0) {
    return res.status(400).json({ message: "El precio unitario debe ser mayor a 0." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO servicios_consumidos
         (reserva_id, categoria, descripcion, cantidad, precio_unitario, fecha, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::date, NOW())
       RETURNING *`,
      [
        reserva_id,
        categoria,
        descFinal.trim(),
        cantFinal,
        Number(precioFinal),
        fechaFinal,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("registrarConsumo error:", e);
    res.status(500).json({ message: "Error al registrar el servicio consumido." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/servicios-consumidos/:id
// Elimina un consumo puntual
// ─────────────────────────────────────────────────────────────────────────────
export const eliminarConsumo = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM servicios_consumidos WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Consumo no encontrado." });
    }
    res.json({ message: "Consumo eliminado.", id: rows[0].id });
  } catch (e) {
    console.error("eliminarConsumo error:", e);
    res.status(500).json({ message: "Error al eliminar el consumo." });
  }
};