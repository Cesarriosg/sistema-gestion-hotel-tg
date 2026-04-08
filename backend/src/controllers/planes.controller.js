// src/controllers/planes.controller.js
// Gestión de planes tarifarios del hotel (EP, CP, MAP, AP, etc.)
// La tabla se auto-crea al arrancar el backend.

import { pool } from "../config/database.js";

// ── Auto-crear tabla + datos semilla ──────────────────────────────────────────
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS planes (
        codigo      VARCHAR(20) PRIMARY KEY,
        descripcion VARCHAR(150) NOT NULL DEFAULT '',
        activo      BOOLEAN NOT NULL DEFAULT true,
        created_at  TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Migrar planes que ya existen en tarifas y reservas (sin duplicar)
    await pool.query(`
      INSERT INTO planes (codigo, descripcion)
      SELECT DISTINCT upper(trim(plan)), ''
      FROM (
        SELECT plan FROM tarifas  WHERE plan IS NOT NULL AND trim(plan) <> ''
        UNION
        SELECT plan FROM reservas WHERE plan IS NOT NULL AND trim(plan) <> ''
      ) t
      WHERE upper(trim(t.plan)) NOT IN (SELECT codigo FROM planes)
      ON CONFLICT (codigo) DO NOTHING
    `);
  } catch (e) {
    console.error("[planes] init error:", e.message);
  }
})();

// GET /api/planes
export const listarPlanes = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT codigo, descripcion, activo
       FROM planes
       ORDER BY codigo ASC`
    );
    res.json(rows);
  } catch (e) {
    console.error("listarPlanes error:", e);
    res.status(500).json({ message: "Error al listar planes." });
  }
};

// POST /api/planes
export const crearPlan = async (req, res) => {
  const { codigo, descripcion = "" } = req.body;
  if (!codigo?.trim()) {
    return res.status(400).json({ message: "El código del plan es obligatorio (ej: EP, CP, MAP)." });
  }
  const codigoNorm = codigo.trim().toUpperCase();
  try {
    const { rows } = await pool.query(
      `INSERT INTO planes (codigo, descripcion) VALUES ($1, $2) RETURNING *`,
      [codigoNorm, descripcion.trim()]
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    if (e.code === "23505") {
      return res.status(409).json({ message: `El plan '${codigoNorm}' ya existe.` });
    }
    console.error("crearPlan error:", e);
    res.status(500).json({ message: "Error al crear plan." });
  }
};

// PUT /api/planes/:codigo
export const actualizarPlan = async (req, res) => {
  const { codigo } = req.params;
  const { descripcion, activo } = req.body;
  try {
    const sets = [];
    const params = [];

    if (descripcion !== undefined) {
      params.push(descripcion.trim());
      sets.push(`descripcion = $${params.length}`);
    }
    if (activo !== undefined) {
      params.push(Boolean(activo));
      sets.push(`activo = $${params.length}`);
    }

    if (!sets.length) {
      return res.status(400).json({ message: "Nada que actualizar." });
    }

    params.push(codigo.trim().toUpperCase());
    const { rows } = await pool.query(
      `UPDATE planes SET ${sets.join(", ")} WHERE codigo = $${params.length} RETURNING *`,
      params
    );
    if (!rows.length) return res.status(404).json({ message: "Plan no encontrado." });
    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarPlan error:", e);
    res.status(500).json({ message: "Error al actualizar plan." });
  }
};

// DELETE /api/planes/:codigo
export const eliminarPlan = async (req, res) => {
  const { codigo } = req.params;
  const codigoNorm = codigo.trim().toUpperCase();
  try {
    // Verificar si tiene tarifas o reservas activas
    const { rows: enTarifas } = await pool.query(
      `SELECT COUNT(*) FROM tarifas WHERE upper(trim(plan)) = $1`,
      [codigoNorm]
    );
    if (Number(enTarifas[0].count) > 0) {
      return res.status(409).json({
        message: `El plan '${codigoNorm}' tiene ${enTarifas[0].count} tarifa(s) asociadas. Elimina primero las tarifas de este plan.`,
      });
    }

    const { rows } = await pool.query(
      `DELETE FROM planes WHERE codigo = $1 RETURNING codigo`,
      [codigoNorm]
    );
    if (!rows.length) return res.status(404).json({ message: "Plan no encontrado." });
    res.json({ message: "Plan eliminado.", codigo: rows[0].codigo });
  } catch (e) {
    console.error("eliminarPlan error:", e);
    res.status(500).json({ message: "Error al eliminar plan." });
  }
};
