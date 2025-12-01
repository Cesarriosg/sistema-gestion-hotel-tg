import { pool } from "../config/database.js";

export const testConnection = async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      mensaje: "Conexión exitosa con el backend y la BD 🏨",
      horaServidorBD: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({ error: "Error al consultar la BD", detalle: error.message });
  }
};
