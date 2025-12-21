// src/controllers/huespedes.controller.js
import { pool } from "../config/database.js";

//
// GET /api/huespedes
// Opcional: ?q=texto&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//
export const listarHuespedes = async (req, res) => {
  const { q, desde, hasta } = req.query;

  const filtros = [];
  const params = [];

  if (q && q.trim() !== "") {
    params.push(`%${q.trim().toLowerCase()}%`);
    filtros.push(
      "(LOWER(h.nombre) LIKE $1 OR LOWER(COALESCE(h.documento, '')) LIKE $1)"
    );
  }

  let filtroFechas = "";
  if (desde && hasta) {
    params.push(desde);
    params.push(hasta);
    const idxDesde = params.length - 1;
    const idxHasta = params.length;
    filtroFechas = `
      AND h.id IN (
        SELECT DISTINCT huesped_id
        FROM reservas
        WHERE fecha_inicio BETWEEN $${idxDesde} AND $${idxHasta}
      )
    `;
  }

  const where =
    filtros.length > 0
      ? `WHERE ${filtros.join(" AND ")} ${filtroFechas}`
      : filtroFechas
      ? `WHERE TRUE ${filtroFechas}`
      : "";

  try {
    const qH = `
      SELECT
        h.id,
        h.nombre,
        h.documento,
        h.telefono,
        h.email,
        h.fecha_nacimiento,
        h.created_at,
        MAX(r.fecha_inicio) AS ultima_estadia
      FROM huespedes h
      LEFT JOIN reservas r ON r.huesped_id = h.id
      ${where}
      GROUP BY h.id
      ORDER BY h.nombre ASC
      LIMIT 200
    `;

    const { rows } = await pool.query(qH, params);
    res.json(rows);
  } catch (e) {
    console.error("listarHuespedes error:", e);
    res.status(500).json({ message: "Error al listar huéspedes." });
  }
};

//
// GET /api/huespedes/:id
//
export const obtenerHuesped = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, documento, telefono, email, fecha_nacimiento
       FROM huespedes
       WHERE id = $1
       LIMIT 1`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ message: "Huésped no encontrado." });
    }
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerHuesped error:", e);
    res.status(500).json({ message: "Error al obtener huésped." });
  }
};

//
// POST /api/huespedes
// (por si algún día quieres registrar huéspedes manualmente desde una pantalla)
//
export const crearHuesped = async (req, res) => {
  const { nombre, documento, telefono, email, fecha_nacimiento } = req.body;

  if (!nombre || nombre.trim() === "") {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO huespedes
         (nombre, documento, telefono, email, fecha_nacimiento)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, nombre, documento, telefono, email, fecha_nacimiento`,
      [
        nombre.trim(),
        documento || null,
        telefono || null,
        email || null,
        fecha_nacimiento || null,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("crearHuesped error:", e);
    res.status(500).json({ message: "Error al crear huésped." });
  }
};

//
// PUT /api/huespedes/:id
//
export const actualizarHuesped = async (req, res) => {
  const { id } = req.params;
  const { nombre, documento, telefono, email, fecha_nacimiento } = req.body;

  if (!nombre || nombre.trim() === "") {
    return res.status(400).json({ message: "El nombre es obligatorio." });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE huespedes
       SET nombre = $1,
           documento = $2,
           telefono = $3,
           email = $4,
           fecha_nacimiento = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING id, nombre, documento, telefono, email, fecha_nacimiento`,
      [
        nombre.trim(),
        documento || null,
        telefono || null,
        email || null,
        fecha_nacimiento || null,
        id,
      ]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Huésped no encontrado." });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarHuesped error:", e);
    res.status(500).json({ message: "Error al actualizar huésped." });
  }
};
