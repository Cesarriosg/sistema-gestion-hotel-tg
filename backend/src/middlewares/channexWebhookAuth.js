export const verificarChannexWebhook = (req, res, next) => {
  const secret = process.env.CHANNEX_WEBHOOK_SECRET || "";
  const header = req.headers["x-ota-secret"] || "";

  if (!secret) {
    return res.status(500).json({ message: "CHANNEX_WEBHOOK_SECRET no configurado." });
  }

  if (String(header) !== String(secret)) {
    return res.status(401).json({ message: "Webhook no autorizado." });
  }

  next();
};
