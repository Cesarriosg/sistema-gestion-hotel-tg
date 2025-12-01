export const obtenerEstadoHabitacion = async (req, res) => {
  const { numero } = req.params;
  const fecha = req.query.fecha;

  const habitacion = await pool.query(
    "SELECT * FROM habitaciones WHERE numero = $1",
    [numero]
  );

  // Buscar reserva activa o para hoy
  const reserva = await pool.query(
    `SELECT r.*,
            h.nombre AS huesped_nombre
     FROM reservas r
     JOIN huespedes h ON r.huesped_id = h.id
     WHERE r.habitacion_id = $1
     AND r.estado != 'cancelada'
     AND r.fecha_inicio <= $2
     AND r.fecha_fin >= $2
     LIMIT 1`,
    [habitacion.rows[0].id, fecha]
  );

  let estado = habitacion.rows[0].estado;

  // Si hay reserva para hoy → llegada hoy
  if (reserva.rowCount > 0 && estado === "reservada") {
    if (reserva.rows[0].fecha_inicio == fecha) {
      estado = "llegada_hoy";
    }
  }

  res.json({
    estado,
    habitacion: habitacion.rows[0],
    reserva: reserva.rows[0] || null
  });
};
