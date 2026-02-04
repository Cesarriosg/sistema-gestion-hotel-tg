// src/controllers/usuarios.controller.js
import { pool } from "../config/database.js";
import bcrypt from "bcryptjs";

const ROLES_VALIDOS = ["admin", "recepcionista"]; // ajusta si tienes otros
const normalizar = (s) => String(s || "").trim();

// helper: validar admin desde req.user
const esAdmin = (req) => {
  const rol = req?.user?.rol || req?.usuario?.rol; // por si tu middleware usa req.usuario
  return String(rol || "").toLowerCase() === "admin";
};

// GET /api/usuarios
export const listarUsuarios = async (req, res) => {
  try {
    if (!esAdmin(req)) return res.status(403).json({ message: "No autorizado." });

    const q = await pool.query(`
      SELECT id, nombre, email, rol, estado, "createdAt", "updatedAt"
      FROM usuarios
      ORDER BY id DESC
    `);

    return res.json(q.rows);
  } catch (e) {
    console.error("listarUsuarios error:", e);
    return res.status(500).json({ message: "Error listando usuarios." });
  }
};

// POST /api/usuarios
export const crearUsuario = async (req, res) => {
  try {
    if (!esAdmin(req)) return res.status(403).json({ message: "No autorizado." });

    const nombre = normalizar(req.body?.nombre);
    const email = normalizar(req.body?.email).toLowerCase();
    const password = String(req.body?.password || "");
    const rol = normalizar(req.body?.rol).toLowerCase();
    const estado = req.body?.estado ?? true;

    if (!nombre) return res.status(400).json({ message: "Nombre es obligatorio." });
    if (!email) return res.status(400).json({ message: "Email es obligatorio." });
    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Password mínimo 6 caracteres." });
    }
    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ message: `Rol inválido. Use: ${ROLES_VALIDOS.join(", ")}` });
    }

    const exist = await pool.query(`SELECT 1 FROM usuarios WHERE lower(email)=lower($1) LIMIT 1`, [email]);
    if (exist.rows.length) return res.status(409).json({ message: "Ya existe un usuario con ese email." });

    const hash = await bcrypt.hash(password, 10);

    const ins = await pool.query(
      `
      INSERT INTO usuarios (nombre, email, password, rol, estado, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, nombre, email, rol, estado, "createdAt", "updatedAt"
      `,
      [nombre, email, hash, rol, Boolean(estado)]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("crearUsuario error:", e);
    return res.status(500).json({ message: "Error creando usuario." });
  }
};

// PUT /api/usuarios/:id
export const actualizarUsuario = async (req, res) => {
  try {
    if (!esAdmin(req)) return res.status(403).json({ message: "No autorizado." });

    const { id } = req.params;
    if (!id || Number.isNaN(Number(id))) return res.status(400).json({ message: "ID inválido." });

    const nombre = normalizar(req.body?.nombre);
    const email = normalizar(req.body?.email).toLowerCase();
    const rol = normalizar(req.body?.rol).toLowerCase();
    const estado = req.body?.estado;

    if (!nombre) return res.status(400).json({ message: "Nombre es obligatorio." });
    if (!email) return res.status(400).json({ message: "Email es obligatorio." });
    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ message: `Rol inválido. Use: ${ROLES_VALIDOS.join(", ")}` });
    }

    // email duplicado en otro usuario
    const exist = await pool.query(
      `SELECT 1 FROM usuarios WHERE lower(email)=lower($1) AND id <> $2 LIMIT 1`,
      [email, id]
    );
    if (exist.rows.length) return res.status(409).json({ message: "Ese email ya lo usa otro usuario." });

    const upd = await pool.query(
      `
      UPDATE usuarios
      SET nombre = $1,
          email  = $2,
          rol    = $3,
          estado = COALESCE($4, estado),
          "updatedAt" = NOW()
      WHERE id = $5
      RETURNING id, nombre, email, rol, estado, "createdAt", "updatedAt"
      `,
      [nombre, email, rol, typeof estado === "boolean" ? estado : null, id]
    );

    if (!upd.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });

    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("actualizarUsuario error:", e);
    return res.status(500).json({ message: "Error actualizando usuario." });
  }
};

// PATCH /api/usuarios/:id/estado
export const cambiarEstadoUsuario = async (req, res) => {
  try {
    if (!esAdmin(req)) return res.status(403).json({ message: "No autorizado." });

    const { id } = req.params;
    const { estado } = req.body || {};

    if (!id || Number.isNaN(Number(id))) return res.status(400).json({ message: "ID inválido." });
    if (typeof estado !== "boolean") return res.status(400).json({ message: "estado debe ser boolean." });

    const upd = await pool.query(
      `
      UPDATE usuarios
      SET estado = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING id, nombre, email, rol, estado, "createdAt", "updatedAt"
      `,
      [estado, id]
    );

    if (!upd.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });
    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("cambiarEstadoUsuario error:", e);
    return res.status(500).json({ message: "Error cambiando estado." });
  }
};

// PATCH /api/usuarios/:id/reset-password
export const resetPasswordUsuario = async (req, res) => {
  try {
    if (!esAdmin(req)) return res.status(403).json({ message: "No autorizado." });

    const { id } = req.params;
    const nueva = String(req.body?.nueva_password || "");

    if (!id || Number.isNaN(Number(id))) return res.status(400).json({ message: "ID inválido." });
    if (!nueva || nueva.length < 6) {
      return res.status(400).json({ message: "La nueva contraseña debe tener mínimo 6 caracteres." });
    }

    const hash = await bcrypt.hash(nueva, 10);

    const upd = await pool.query(
      `
      UPDATE usuarios
      SET password = $1, "updatedAt" = NOW()
      WHERE id = $2
      RETURNING id, nombre, email, rol, estado, "createdAt", "updatedAt"
      `,
      [hash, id]
    );

    if (!upd.rows.length) return res.status(404).json({ message: "Usuario no encontrado." });

    return res.json({ message: "Contraseña restablecida correctamente.", usuario: upd.rows[0] });
  } catch (e) {
    console.error("resetPasswordUsuario error:", e);
    return res.status(500).json({ message: "Error restableciendo contraseña." });
  }
};

// DELETE /api/usuarios/:id
export const eliminarUsuario = async (req, res) => {
  try {
    if (!esAdmin(req)) return res.status(403).json({ message: "No autorizado." });

    const { id } = req.params;
    if (!id || Number.isNaN(Number(id))) return res.status(400).json({ message: "ID inválido." });

    await pool.query(`DELETE FROM usuarios WHERE id = $1`, [id]);
    return res.json({ message: "Usuario eliminado." });
  } catch (e) {
    console.error("eliminarUsuario error:", e);
    return res.status(500).json({ message: "Error eliminando usuario." });
  }
};
