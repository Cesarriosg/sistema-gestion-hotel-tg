// src/middlewares/authMiddleware.js
import jwt from "jsonwebtoken";

/**
 * verificarToken — valida el Bearer token en el header Authorization
 * Agrega req.usuario = { id, rol } si es válido
 */
export const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"] || req.headers["Authorization"];

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token no proporcionado." });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret_key");
    req.usuario = decoded; // { id, rol }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Sesión expirada. Vuelve a iniciar sesión." });
    }
    return res.status(401).json({ message: "Token inválido." });
  }
};

/**
 * soloAdmin — requiere que req.usuario.rol === 'admin'
 * Debe usarse DESPUÉS de verificarToken
 */
export const soloAdmin = (req, res, next) => {
  if (!req.usuario) {
    return res.status(401).json({ message: "No autenticado." });
  }
  if (req.usuario.rol !== "admin") {
    return res.status(403).json({ message: "Acceso restringido a administradores." });
  }
  next();
};