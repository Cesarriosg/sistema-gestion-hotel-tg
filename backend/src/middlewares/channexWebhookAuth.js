// src/middlewares/channexWebhookAuth.js
// Channex envía un header x-channex-signature con HMAC-SHA256 del body.
// En sandbox/staging se puede deshabilitar la verificación de firma.

import crypto from "crypto";

export const verificarChannexWebhook = (req, res, next) => {
  // En staging no forzamos firma — solo logueamos
  const signature = req.headers["x-channex-signature"] || "";
  const secret    = process.env.CHANNEX_WEBHOOK_SECRET || "";

  if (secret && signature) {
    // Aceptar comparación directa (clave estática) O HMAC-SHA256
    if (signature === secret) {
      return next();
    }
    const expected = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");
    if (signature !== expected) {
      console.warn("⚠️  Channex webhook signature mismatch — rechazado");
      return res.status(401).json({ message: "Webhook signature inválida." });
    }
  }

  // Sin secret configurado → permitir (demo)
  next();
};