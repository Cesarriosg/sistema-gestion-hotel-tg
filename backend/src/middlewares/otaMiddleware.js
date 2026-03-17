
export const verificarOtaSecret = (req, res, next) => {
  const secret = req.headers["x-ota-secret"];
  const expected = process.env.OTA_SECRET || "hotel_tg_secret_2024";

  if (!secret || secret !== expected) {
    return res.status(401).json({ message: "OTA secret inválido." });
  }
  next();
};