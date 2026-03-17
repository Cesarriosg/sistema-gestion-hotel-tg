// src/routes/otas.routes.js
import { Router } from "express";
import { verificarToken, soloAdmin } from "../middlewares/authMiddleware.js";
import { verificarOtaSecret }       from "../middlewares/otaMiddleware.js";
import { verificarChannexWebhook }  from "../middlewares/channexWebhookAuth.js";
import {
  channexWebhook,
  otaCrearOActualizarReservaSandbox,
  otaCancelarReservaSandbox,
  otaGetConfig,
  otaUpsertConfig,
  otaStatsReservas,
  otaSyncLog,
} from "../controllers/otas.controller.js";

const router = Router();

// ── Webhook Channex (RF-15 entrante) — sin JWT, Channex llama desde fuera ───
router.post("/channex/webhook", verificarChannexWebhook, channexWebhook);

// ── Sandbox (pruebas sin Channex real) ──────────────────────────────────────
router.post("/sandbox/reserva",          verificarOtaSecret, otaCrearOActualizarReservaSandbox);
router.post("/sandbox/reserva/cancelar", verificarOtaSecret, otaCancelarReservaSandbox);

// ── Config por canal (solo admin) ───────────────────────────────────────────
router.get("/config/:ota_canal",  verificarToken, soloAdmin, otaGetConfig);
router.put("/config/:ota_canal",  verificarToken, soloAdmin, otaUpsertConfig);

// ── Estadísticas ─────────────────────────────────────────────────────────────
router.get("/stats/reservas",     verificarToken, otaStatsReservas);

// ── Log de sincronizaciones RF-16/17 ────────────────────────────────────────
router.get("/sync-log",           verificarToken, soloAdmin, otaSyncLog);

export default router;