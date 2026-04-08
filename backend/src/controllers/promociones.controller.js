// src/controllers/promociones.controller.js
import { pool } from "../config/database.js";

// Auto-crear tabla al iniciar
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS promociones (
        id           SERIAL PRIMARY KEY,
        nombre       VARCHAR(100) NOT NULL,
        descripcion  TEXT,
        tipo         VARCHAR(20)  NOT NULL DEFAULT 'porcentaje', -- 'porcentaje' | 'monto_fijo' | 'noches_gratis'
        valor        NUMERIC(10,2) NOT NULL DEFAULT 0,           -- % o monto o noches gratis
        min_noches   INT          DEFAULT 1,
        plan         VARCHAR(50),                                 -- NULL = aplica a todos los planes
        tipo_habitacion VARCHAR(100),                            -- NULL = todos los tipos
        fecha_inicio DATE,
        fecha_fin    DATE,
        activa       BOOLEAN      NOT NULL DEFAULT true,
        created_at   TIMESTAMP    DEFAULT NOW(),
        updated_at   TIMESTAMP    DEFAULT NOW()
      )
    `);
    console.log("[Promociones] Tabla lista.");
  } catch (e) {
    console.error("[Promociones] Error creando tabla:", e.message);
  }
})();

// GET /api/promociones
export const listarPromociones = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM promociones ORDER BY activa DESC, created_at DESC`
    );
    res.json(rows);
  } catch (e) {
    console.error("listarPromociones error:", e);
    res.status(500).json({ message: "Error al listar promociones." });
  }
};

// POST /api/promociones
export const crearPromocion = async (req, res) => {
  const { nombre, descripcion, tipo, valor, min_noches, plan, tipo_habitacion, fecha_inicio, fecha_fin } = req.body || {};

  if (!nombre?.trim()) return res.status(400).json({ message: "El nombre es obligatorio." });
  if (!["porcentaje", "monto_fijo", "noches_gratis"].includes(tipo)) {
    return res.status(400).json({ message: "Tipo inválido. Use: porcentaje, monto_fijo, noches_gratis." });
  }
  if (Number(valor) < 0) return res.status(400).json({ message: "El valor no puede ser negativo." });
  if (tipo === "porcentaje" && Number(valor) > 100) {
    return res.status(400).json({ message: "El porcentaje no puede superar 100%." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO promociones (nombre, descripcion, tipo, valor, min_noches, plan, tipo_habitacion, fecha_inicio, fecha_fin, activa, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,true,NOW(),NOW())
       RETURNING *`,
      [
        nombre.trim(), descripcion?.trim() || null, tipo, Number(valor),
        Number(min_noches) || 1,
        plan?.trim() || null, tipo_habitacion?.trim() || null,
        fecha_inicio || null, fecha_fin || null,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("crearPromocion error:", e);
    res.status(500).json({ message: "Error al crear la promoción." });
  }
};

// PUT /api/promociones/:id
export const actualizarPromocion = async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, tipo, valor, min_noches, plan, tipo_habitacion, fecha_inicio, fecha_fin } = req.body || {};

  if (!nombre?.trim()) return res.status(400).json({ message: "El nombre es obligatorio." });

  try {
    const { rows } = await pool.query(
      `UPDATE promociones
       SET nombre=$1, descripcion=$2, tipo=$3, valor=$4, min_noches=$5,
           plan=$6, tipo_habitacion=$7, fecha_inicio=$8, fecha_fin=$9, updated_at=NOW()
       WHERE id=$10
       RETURNING *`,
      [
        nombre.trim(), descripcion?.trim() || null, tipo, Number(valor),
        Number(min_noches) || 1,
        plan?.trim() || null, tipo_habitacion?.trim() || null,
        fecha_inicio || null, fecha_fin || null, id,
      ]
    );
    if (!rows.length) return res.status(404).json({ message: "Promoción no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarPromocion error:", e);
    res.status(500).json({ message: "Error al actualizar la promoción." });
  }
};

// PATCH /api/promociones/:id/activa — Activar / desactivar
export const toggleActivaPromocion = async (req, res) => {
  const { id } = req.params;
  const { activa } = req.body || {};
  try {
    const { rows } = await pool.query(
      `UPDATE promociones SET activa=$1, updated_at=NOW() WHERE id=$2 RETURNING *`,
      [Boolean(activa), id]
    );
    if (!rows.length) return res.status(404).json({ message: "Promoción no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("toggleActivaPromocion error:", e);
    res.status(500).json({ message: "Error al cambiar estado." });
  }
};

// DELETE /api/promociones/:id
export const eliminarPromocion = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `DELETE FROM promociones WHERE id=$1 RETURNING id`, [id]
    );
    if (!rows.length) return res.status(404).json({ message: "Promoción no encontrada." });
    res.json({ message: "Promoción eliminada." });
  } catch (e) {
    console.error("eliminarPromocion error:", e);
    res.status(500).json({ message: "Error al eliminar la promoción." });
  }
};
