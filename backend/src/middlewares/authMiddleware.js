import jwt from "jsonwebtoken";

export const verificarToken = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) return res.status(403).json({ error: "Token requerido" });

  jwt.verify(token, process.env.JWT_SECRET || "secret_key", (err, decoded) => {
    if (err) return res.status(401).json({ error: "Token inválido" });

    req.usuario = decoded;
    next();
  });
};

export const soloAdmin = (req, res, next) => {
  if (req.usuario.rol !== "admin")
    return res.status(403).json({ error: "Acceso solo para administradores" });
  next();
};
