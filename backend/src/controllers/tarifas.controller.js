// src/controllers/tarifas.controller.js
import { pool } from "../config/database.js";

const TEMPORADAS = ["base", "alta", "especial"];

// GET /api/tarifas/planes — planes dinámicos (no hardcodeados)
export const listarPlanes = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT upper(trim(plan)) AS plan
      FROM (
        SELECT plan FROM tarifas  WHERE plan IS NOT NULL AND trim(plan) <> ''
        UNION
        SELECT plan FROM reservas WHERE plan IS NOT NULL AND trim(plan) <> ''
      ) t
      ORDER BY plan
    `);
    res.json(rows.map((r) => r.plan));
  } catch (e) {
    console.error("listarPlanes error:", e);
    res.status(500).json({ message: "Error al listar planes." });
  }
};

// GET /api/tarifas
export const listarTarifas = async (req, res) => {
  try {
    const { plan = "", tipo_habitacion = "", temporada = "", vigente = "" } = req.query;
    const where = []; const params = [];
    if (plan.trim()) { params.push(plan.trim()); where.push(`upper(t.plan) = upper($${params.length})`); }
    if (tipo_habitacion.trim()) { params.push(tipo_habitacion.trim()); where.push(`lower(trim(t.tipo_habitacion)) = lower(trim($${params.length}))`); }
    if (temporada.trim()) { params.push(temporada.trim()); where.push(`lower(t.temporada) = lower($${params.length})`); }
    if (vigente === "true")  where.push(`t.fecha_inicio <= CURRENT_DATE AND t.fecha_fin >= CURRENT_DATE`);
    if (vigente === "false") where.push(`t.fecha_fin < CURRENT_DATE`);
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const { rows } = await pool.query(`
      SELECT t.id, t.tipo_habitacion, upper(trim(t.plan)) AS plan, t.precio,
             t.fecha_inicio, t.fecha_fin, t.temporada, t.created_at, t.updated_at,
             (t.fecha_inicio <= CURRENT_DATE AND t.fecha_fin >= CURRENT_DATE) AS vigente_hoy
      FROM tarifas t ${whereSql}
      ORDER BY upper(t.plan) ASC, t.tipo_habitacion ASC, t.fecha_inicio DESC
    `, params);
    res.json(rows);
  } catch (e) {
    console.error("listarTarifas error:", e);
    res.status(500).json({ message: "Error al listar tarifas." });
  }
};

// GET /api/tarifas/:id
export const obtenerTarifa = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, tipo_habitacion, upper(trim(plan)) AS plan, precio,
              fecha_inicio, fecha_fin, temporada, created_at, updated_at
       FROM tarifas WHERE id = $1 LIMIT 1`, [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Tarifa no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerTarifa error:", e);
    res.status(500).json({ message: "Error al obtener tarifa." });
  }
};

// POST /api/tarifas — plan es texto libre (C1, C2, GK, EJECUTIVO, etc.)
export const crearTarifa = async (req, res) => {
  const { tipo_habitacion, plan, precio, fecha_inicio, fecha_fin, temporada = "base" } = req.body;
  if (!tipo_habitacion?.trim()) return res.status(400).json({ message: "tipo_habitacion es obligatorio." });
  if (!plan?.trim()) return res.status(400).json({ message: "El nombre del plan es obligatorio (ej: C1, C2, GK)." });
  if (!fecha_inicio) return res.status(400).json({ message: "fecha_inicio es obligatoria." });
  if (!fecha_fin)    return res.status(400).json({ message: "fecha_fin es obligatoria." });
  const precioNum = Number(precio);
  if (isNaN(precioNum) || precioNum <= 0) return res.status(400).json({ message: "precio debe ser mayor a 0." });
  if (fecha_fin < fecha_inicio) return res.status(400).json({ message: "fecha_fin debe ser >= fecha_inicio." });
  const planNorm = plan.trim().toUpperCase();
  const tempNorm = (temporada || "base").toLowerCase();
  if (!TEMPORADAS.includes(tempNorm)) return res.status(400).json({ message: `Temporada invalida. Use: ${TEMPORADAS.join(", ")}.` });
  try {
    const { rows: solape } = await pool.query(`
      SELECT id FROM tarifas
      WHERE lower(trim(tipo_habitacion)) = lower(trim($1))
        AND upper(trim(plan)) = $2
        AND lower(temporada)  = $3
        AND daterange(fecha_inicio, fecha_fin, '[]') && daterange($4::date, $5::date, '[]')
      LIMIT 1
    `, [tipo_habitacion.trim(), planNorm, tempNorm, fecha_inicio, fecha_fin]);
    if (solape.length) return res.status(409).json({
      message: `Ya existe una tarifa para plan '${planNorm}', tipo '${tipo_habitacion}', temporada '${tempNorm}' que se superpone con esas fechas.`,
    });
    const { rows } = await pool.query(`
      INSERT INTO tarifas (tipo_habitacion, plan, precio, fecha_inicio, fecha_fin, temporada, created_at, updated_at)
      VALUES (upper(trim($1)), $2, $3, $4::date, $5::date, $6, NOW(), NOW())
      RETURNING *
    `, [tipo_habitacion.trim(), planNorm, precioNum, fecha_inicio, fecha_fin, tempNorm]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("crearTarifa error:", e);
    res.status(500).json({ message: "Error al crear tarifa." });
  }
};

// PUT /api/tarifas/:id
export const actualizarTarifa = async (req, res) => {
  const { id } = req.params;
  const { tipo_habitacion, plan, precio, fecha_inicio, fecha_fin, temporada = "base" } = req.body;
  if (!tipo_habitacion?.trim()) return res.status(400).json({ message: "tipo_habitacion es obligatorio." });
  if (!plan?.trim()) return res.status(400).json({ message: "El plan es obligatorio." });
  if (!fecha_inicio) return res.status(400).json({ message: "fecha_inicio es obligatoria." });
  if (!fecha_fin)    return res.status(400).json({ message: "fecha_fin es obligatoria." });
  const precioNum = Number(precio);
  if (isNaN(precioNum) || precioNum <= 0) return res.status(400).json({ message: "precio debe ser mayor a 0." });
  if (fecha_fin < fecha_inicio) return res.status(400).json({ message: "fecha_fin debe ser >= fecha_inicio." });
  const planNorm = plan.trim().toUpperCase();
  const tempNorm = (temporada || "base").toLowerCase();
  try {
    const { rows: solape } = await pool.query(`
      SELECT id FROM tarifas
      WHERE lower(trim(tipo_habitacion)) = lower(trim($1))
        AND upper(trim(plan)) = $2
        AND lower(temporada)  = $3
        AND daterange(fecha_inicio, fecha_fin, '[]') && daterange($4::date, $5::date, '[]')
        AND id <> $6
      LIMIT 1
    `, [tipo_habitacion.trim(), planNorm, tempNorm, fecha_inicio, fecha_fin, id]);
    if (solape.length) return res.status(409).json({ message: "Otro registro ya cubre ese rango para el mismo plan/tipo/temporada." });
    const { rows } = await pool.query(`
      UPDATE tarifas SET tipo_habitacion=upper(trim($1)), plan=$2, precio=$3,
        fecha_inicio=$4::date, fecha_fin=$5::date, temporada=$6, updated_at=NOW()
      WHERE id=$7 RETURNING *
    `, [tipo_habitacion.trim(), planNorm, precioNum, fecha_inicio, fecha_fin, tempNorm, id]);
    if (!rows.length) return res.status(404).json({ message: "Tarifa no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarTarifa error:", e);
    res.status(500).json({ message: "Error al actualizar tarifa." });
  }
};

// DELETE /api/tarifas/:id
export const eliminarTarifa = async (req, res) => {
  try {
    const { rows } = await pool.query(`DELETE FROM tarifas WHERE id=$1 RETURNING id`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Tarifa no encontrada." });
    res.json({ message: "Tarifa eliminada.", id: rows[0].id });
  } catch (e) {
    console.error("eliminarTarifa error:", e);
    res.status(500).json({ message: "Error al eliminar tarifa." });
  }
};

// GET /api/tarifas/resumen
export const resumenTarifas = async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (upper(trim(plan)), lower(trim(tipo_habitacion)))
        upper(trim(plan)) AS plan, tipo_habitacion,
        precio, fecha_inicio, fecha_fin, temporada, true AS vigente_hoy
      FROM tarifas
      WHERE fecha_inicio <= CURRENT_DATE AND fecha_fin >= CURRENT_DATE
      ORDER BY upper(trim(plan)), lower(trim(tipo_habitacion)), fecha_inicio DESC
    `);
    res.json(rows);
  } catch (e) {
    console.error("resumenTarifas error:", e);
    res.status(500).json({ message: "Error al obtener resumen." });
  }
};