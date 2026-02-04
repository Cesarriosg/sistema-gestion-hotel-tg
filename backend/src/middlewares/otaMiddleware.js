export const verificarOtaSecret = (req, res, next) => {
  const secret = req.headers["x-ota-secret"];
  if (!secret || secret !== process.env.OTA_SECRET) {
    return res.status(401).json({ message: "OTA secret inválido." });
  }
  next();
};
