// src/controllers/tiposHabitacion.controller.js
import { pool } from "../config/database.js";

const normalizar = (s) => String(s || "").trim();

export const listarTiposHabitacion = async (req, res) => {
  try {
    const { incluirInactivos = "true" } = req.query;

    const where = String(incluirInactivos) === "false" ? "WHERE activo = true" : "";

    const q = await pool.query(`
      SELECT id, nombre, codigo, descripcion, activo, created_at, updated_at
      FROM tipos_habitacion
      ${where}
      ORDER BY nombre ASC
    `);

    return res.json(q.rows);
  } catch (e) {
    console.error("listarTiposHabitacion error:", e);
    return res.status(500).json({ message: "Error listando tipos de habitación." });
  }
};

export const crearTipoHabitacion = async (req, res) => {
  const nombre = normalizar(req.body?.nombre);
  const codigo = normalizar(req.body?.codigo);
  const descripcion = normalizar(req.body?.descripcion);

  if (!nombre) return res.status(400).json({ message: "nombre es obligatorio." });
  if (!codigo) return res.status(400).json({ message: "codigo es obligatorio." });

  try {
    const exist = await pool.query(
      `
      SELECT id
      FROM tipos_habitacion
      WHERE LOWER(nombre) = LOWER($1) OR LOWER(codigo) = LOWER($2)
      LIMIT 1
      `,
      [nombre, codigo]
    );

    if (exist.rows.length) {
      return res.status(409).json({ message: "Ya existe un tipo con ese nombre o código." });
    }

    const ins = await pool.query(
      `
      INSERT INTO tipos_habitacion (nombre, codigo, descripcion, activo, created_at, updated_at)
      VALUES ($1, $2, $3, true, NOW(), NOW())
      RETURNING id, nombre, codigo, descripcion, activo, created_at, updated_at
      `,
      [nombre, codigo, descripcion || null]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("crearTipoHabitacion error:", e);
    return res.status(500).json({ message: "Error creando tipo de habitación." });
  }
};

export const actualizarTipoHabitacion = async (req, res) => {
  const { id } = req.params;
  const nombre = normalizar(req.body?.nombre);
  const codigo = normalizar(req.body?.codigo);
  const descripcion = normalizar(req.body?.descripcion);

  if (!id || Number.isNaN(Number(id))) return res.status(400).json({ message: "ID inválido." });
  if (!nombre) return res.status(400).json({ message: "nombre es obligatorio." });
  if (!codigo) return res.status(400).json({ message: "codigo es obligatorio." });

  try {
    const exist = await pool.query(
      `
      SELECT id
      FROM tipos_habitacion
      WHERE (LOWER(nombre) = LOWER($1) OR LOWER(codigo) = LOWER($2))
        AND id <> $3
      LIMIT 1
      `,
      [nombre, codigo, id]
    );

    if (exist.rows.length) {
      return res.status(409).json({ message: "Otro tipo ya tiene ese nombre o código." });
    }

    const upd = await pool.query(
      `
      UPDATE tipos_habitacion
      SET nombre = $1,
          codigo = $2,
          descripcion = $3,
          updated_at = NOW()
      WHERE id = $4
      RETURNING id, nombre, codigo, descripcion, activo, created_at, updated_at
      `,
      [nombre, codigo, descripcion || null, id]
    );

    if (!upd.rows.length) return res.status(404).json({ message: "Tipo no encontrado." });

    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("actualizarTipoHabitacion error:", e);
    return res.status(500).json({ message: "Error actualizando tipo de habitación." });
  }
};

export const cambiarEstadoTipoHabitacion = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body || {};

  if (!id || Number.isNaN(Number(id))) return res.status(400).json({ message: "ID inválido." });

  const nuevoActivo = Boolean(activo);

  try {
    if (!nuevoActivo) {
      //  trae nombre del tipo
      const t = await pool.query(
        `SELECT nombre FROM tipos_habitacion WHERE id = $1 LIMIT 1`,
        [id]
      );
      if (!t.rows.length) return res.status(404).json({ message: "Tipo no encontrado." });

      const nombreTipo = t.rows[0].nombre;

      //  ojo: tu tabla es habitaciones (plural)
      const used = await pool.query(
        `
        SELECT 1
        FROM habitaciones
        WHERE LOWER(tipo) = LOWER($1)
          AND (activo IS NULL OR activo = true)
        LIMIT 1
        `,
        [nombreTipo]
      );

      if (used.rows.length) {
        return res.status(400).json({
          message:
            "No puedes desactivar este tipo porque ya está asignado a habitaciones activas. Primero cambia el tipo en esas habitaciones.",
        });
      }
    }

    const upd = await pool.query(
      `
      UPDATE tipos_habitacion
      SET activo = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, nombre, codigo, descripcion, activo, created_at, updated_at
      `,
      [nuevoActivo, id]
    );

    if (!upd.rows.length) return res.status(404).json({ message: "Tipo no encontrado." });

    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("cambiarEstadoTipoHabitacion error:", e);
    return res.status(500).json({ message: "Error activando/desactivando tipo." });
  }
};
