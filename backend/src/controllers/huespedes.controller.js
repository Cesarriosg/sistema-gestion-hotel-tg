import { pool } from "../config/database.js";

export const crearHuesped = async (req, res) => {
  try {
    const { nombre, tipo_documento, numero_documento, telefono, email, direccion } = req.body;
    if (!nombre) return res.status(400).json({ error: "nombre es requerido" });
    const q = `INSERT INTO huespedes (nombre, tipo_documento, numero_documento, telefono, email, direccion)
               VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`;
    const { rows } = await pool.query(q, [nombre, tipo_documento, numero_documento, telefono, email, direccion]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const listarHuespedes = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM huespedes ORDER BY id DESC");
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const obtenerHuesped = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM huespedes WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const actualizarHuesped = async (req, res) => {
  try {
    const { nombre, tipo_documento, numero_documento, telefono, email, direccion } = req.body;
    const q = `UPDATE huespedes SET
               nombre=COALESCE($1,nombre),
               tipo_documento=COALESCE($2,tipo_documento),
               numero_documento=COALESCE($3,numero_documento),
               telefono=COALESCE($4,telefono),
               email=COALESCE($5,email),
               direccion=COALESCE($6,direccion),
               updated_at=NOW()
               WHERE id=$7 RETURNING *`;
    const { rows } = await pool.query(q, [nombre, tipo_documento, numero_documento, telefono, email, direccion, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "No encontrado" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const eliminarHuesped = async (req, res) => {
  try {
    const { rowCount } = await pool.query("DELETE FROM huespedes WHERE id=$1", [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: "No encontrado" });
    res.json({ mensaje: "Eliminado" });
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const buscarHuespedPorDocumento = async (req, res) => {
  try {
    const { documento } = req.params;
    const query = "SELECT * FROM huespedes WHERE documento = $1 LIMIT 1";
    const { rows } = await pool.query(query, [documento]);

    if (rows.length === 0) {
      return res.status(404).json({ encontrado: false });
    }

    return res.json({ encontrado: true, huesped: rows[0] });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

