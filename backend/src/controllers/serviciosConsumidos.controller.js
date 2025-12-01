import { pool } from "../config/database.js";

export const registrarConsumo = async (req, res) => {
  try {
    const { reserva_id, servicio_id, costo } = req.body;

    if (!reserva_id || !servicio_id || !costo) {
      return res.status(400).json({ error: "Todos los campos son obligatorios" });
    }

    const query = `
      INSERT INTO servicios_consumidos (reserva_id, servicio_id, costo)
      VALUES ($1, $2, $3)
    `;

    await pool.query(query, [reserva_id, servicio_id, costo]);

    return res.json({ mensaje: "Servicio registrado correctamente ✅" });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error al registrar el servicio consumido" });
  }
};
