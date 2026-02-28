
import { pool } from "../config/database.js";
import dayjs from "dayjs";

export const obtenerEstadoHabitacion = async (req, res) => {
  const { numero } = req.params;
  const fecha = req.query.fecha;

  try {
    const habitacionQ = await pool.query(
      "SELECT * FROM habitaciones WHERE numero = $1 LIMIT 1",
      [numero]
    );

    if (!habitacionQ.rows.length) {
      return res.status(404).json({ message: "Habitación no existe." });
    }

    const habitacion = habitacionQ.rows[0];

    const reservaQ = await pool.query(
      `SELECT r.*,
              COALESCE(h.nombre, '—') AS huesped_nombre
       FROM reservas r
       LEFT JOIN huespedes h ON r.huesped_id = h.id
       WHERE r.habitacion_id = $1
         AND r.estado != 'cancelada'
         AND r.fecha_inicio <= $2
         AND r.fecha_fin > $2
       ORDER BY r.id DESC
       LIMIT 1`,
      [habitacion.id, fecha]
    );

    const reserva = reservaQ.rows[0] || null;

    let estado = habitacion.estado;

    // llegada_hoy si hay reserva para hoy y hab está reservada
    if (reserva && estado === "reservada") {
      const inicio = dayjs(reserva.fecha_inicio).format("YYYY-MM-DD");
      if (inicio === fecha) estado = "llegada_hoy";
    }

    return res.json({ estado, habitacion, reserva });
  } catch (e) {
    console.error("obtenerEstadoHabitacion error:", e);
    return res.status(500).json({ message: "Error interno." });
  }
};