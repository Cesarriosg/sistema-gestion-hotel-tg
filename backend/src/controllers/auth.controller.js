import pool from "../config/database.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const registrarUsuario = async (req, res) => {
  try {
    const { nombre, email, password, rol } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const query = `INSERT INTO usuarios (nombre, email, password, rol)
                   VALUES ($1, $2, $3, $4) RETURNING id`;

    const result = await pool.query(query, [nombre, email, hash, rol]);

    return res.json({ mensaje: "Usuario creado correctamente", id: result.rows[0].id });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const query = "SELECT * FROM usuarios WHERE email = $1";
    const result = await pool.query(query, [email]);

    if (result.rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });

    const usuario = result.rows[0];
    const match = await bcrypt.compare(password, usuario.password);

    if (!match)
      return res.status(401).json({ error: "Contraseña incorrecta" });

    const token = jwt.sign(
      { id: usuario.id, rol: usuario.rol },
      process.env.JWT_SECRET || "secret_key",
      { expiresIn: "8h" }
    );

    return res.json({ mensaje: "Login exitoso", token, rol: usuario.rol });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
