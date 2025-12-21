// src/controllers/habitaciones.controller.js
import { pool } from "../config/database.js";

// GET /api/habitaciones
export const listarHabitaciones = async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, numero, tipo, estado
       FROM habitaciones
       ORDER BY numero::int ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error("listarHabitaciones error:", e);
    res.status(500).json({ message: "Error al listar habitaciones." });
  }
};

// PUT /api/habitaciones/:id/estado
export const actualizarEstadoHabitacion = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body; // 'disponible' | 'ocupada' | 'mantenimiento' | 'fuera_servicio'

  const estadosPermitidos = [
    "disponible",
    "ocupada",
    "mantenimiento",
    "fuera_servicio",
  ];

  if (!estadosPermitidos.includes(estado)) {
    return res.status(400).json({ message: "Estado de habitación no válido." });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE habitaciones
       SET estado = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, numero, tipo, estado`,
      [estado, id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Habitación no encontrada." });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarEstadoHabitacion error:", e);
    res.status(500).json({ message: "Error al actualizar estado de habitación." });
  }
};
