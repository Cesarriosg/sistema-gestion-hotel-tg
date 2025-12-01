import express from "express";
import { pool } from "../config/database.js";

const router = express.Router();

// ✅ Obtener fecha del sistema (fecha operativa del hotel)
router.get("/fecha-sistema", async (req, res) => {
  try {
    const result = await pool.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
    res.json({ fecha: result.rows[0].fecha_sistema });
  } catch (error) {
    console.error("Error al obtener fecha del sistema:", error);
    res.status(500).json({ error: "Error al obtener fecha del sistema" });
  }
});

// ✅ Actualizar manualmente la fecha del sistema (para cierre de día)
router.put("/fecha-sistema", async (req, res) => {
  try {
    const { nueva_fecha } = req.body;
    if (!nueva_fecha) {
      return res.status(400).json({ error: "Debe proporcionar una nueva fecha" });
    }

    await pool.query("UPDATE configuracion SET fecha_sistema = $1", [nueva_fecha]);
    res.json({ mensaje: "Fecha del sistema actualizada correctamente" });
  } catch (error) {
    console.error("Error al actualizar fecha del sistema:", error);
    res.status(500).json({ error: "Error al actualizar la fecha" });
  }
});

export default router;
