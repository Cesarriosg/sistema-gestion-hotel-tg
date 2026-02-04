import { Router } from "express";
import { verificarOtaSecret } from "../middlewares/otaMiddleware.js";
import {
  otaCrearOActualizarReservaSandbox,
  otaCancelarReservaSandbox,
  otaGetConfig,
  otaUpsertConfig,
  otaStatsReservas,
} from "../controllers/otas.controller.js";
import { verificarChannexWebhook } from "../middlewares/channexWebhookAuth.js";
//import { channexWebhook } from "../controllers/otas.controller.js"; 
import { channexWebhook } from "../controllers/otas.controller.js";

const router = Router();

/**
 * ✅ Webhook sandbox (NO JWT). Se protege con x-ota-secret
 * POST /api/otas/sandbox/reserva
 */
router.post("/sandbox/reserva", verificarOtaSecret, otaCrearOActualizarReservaSandbox);

/**
 * ✅ Cancelación (idempotente)
 * POST /api/otas/sandbox/reserva/cancelar
 * body: { ota_canal, ota_reserva_id, motivo? }
 */
router.post("/sandbox/reserva/cancelar", verificarOtaSecret, otaCancelarReservaSandbox);

/**
 * ✅ Configuración por OTA (SOLO ADMIN, pero como es TG puedes dejarlo con JWT más adelante)
 * Para tu demo lo puedes proteger también con x-ota-secret o con JWT admin.
 *
 * GET  /api/otas/config/:ota_canal
 * PUT  /api/otas/config/:ota_canal
 */
router.get("/config/:ota_canal", otaGetConfig);
router.put("/config/:ota_canal", otaUpsertConfig);

/**
 * ✅ Estadísticas
 * GET /api/otas/stats/reservas?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
 */
router.get("/stats/reservas", otaStatsReservas);

router.post("/channex/webhook", channexWebhook);

export default router;
