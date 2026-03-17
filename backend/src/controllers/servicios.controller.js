// src/controllers/servicios_controller.js — RF-20: CRUD catálogo de servicios adicionales

import { pool } from "../config/database.js";

// GET /api/servicios
export const listarServicios = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, descripcion, precio, unidad, activo, "createdAt"
       FROM servicios
       ORDER BY nombre ASC`
    );
    res.json(rows);
  } catch(e) {
    console.error("listarServicios:", e);
    res.status(500).json({ message: "Error al listar servicios." });
  }
};

// GET /api/servicios/:id
export const obtenerServicio = async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT * FROM servicios WHERE id = $1`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ message: "Servicio no encontrado." });
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({ message: "Error al obtener servicio." });
  }
};

// POST /api/servicios
export const crearServicio = async (req, res) => {
  const { nombre, descripcion, precio, unidad, activo } = req.body;
  if (!nombre?.trim() || precio === undefined) {
    return res.status(400).json({ message: "Nombre y precio son obligatorios." });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO servicios (nombre, descripcion, precio, unidad, activo)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nombre.trim(), descripcion?.trim() || null, Number(precio), unidad || "por unidad", activo !== false]
    );
    res.status(201).json(rows[0]);
  } catch(e) {
    console.error("crearServicio:", e);
    res.status(500).json({ message: "Error al crear servicio." });
  }
};

// PUT /api/servicios/:id
export const actualizarServicio = async (req, res) => {
  const { nombre, descripcion, precio, unidad, activo } = req.body;
  if (!nombre?.trim() || precio === undefined) {
    return res.status(400).json({ message: "Nombre y precio son obligatorios." });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE servicios
       SET nombre=$1, descripcion=$2, precio=$3, unidad=$4, activo=$5, updated_at=NOW()
       WHERE id=$6
       RETURNING *`,
      [nombre.trim(), descripcion?.trim() || null, Number(precio), unidad || "por unidad", activo !== false, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ message: "Servicio no encontrado." });
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({ message: "Error al actualizar servicio." });
  }
};

// DELETE /api/servicios/:id
export const eliminarServicio = async (req, res) => {
  try {
    // Marcar como inactivo si tiene consumos, borrar si no
    const { rows: usos } = await pool.query(
      `SELECT COUNT(*) FROM servicios_consumidos WHERE servicio_id=$1`, [req.params.id]
    );
    if (Number(usos[0].count) > 0) {
      await pool.query(`UPDATE servicios SET activo=false WHERE id=$1`, [req.params.id]);
      return res.json({ message: "Servicio marcado como inactivo (tiene consumos asociados)." });
    }
    const { rowCount } = await pool.query(`DELETE FROM servicios WHERE id=$1`, [req.params.id]);
    if (!rowCount) return res.status(404).json({ message: "Servicio no encontrado." });
    res.json({ message: "Servicio eliminado correctamente." });
  } catch(e) {
    console.error("eliminarServicio:", e);
    res.status(500).json({ message: "Error al eliminar servicio." });
  }
};