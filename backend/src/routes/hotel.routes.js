// src/routes/hotel.routes.js
import { Router } from "express";
import { verificarToken, soloAdmin } from "../middlewares/authMiddleware.js";
import {
  testConnection,
  obtenerConfigHotel,
  actualizarConfigHotel,
  obtenerFechaSistema,
  actualizarFechaSistema,
  obtenerDashboard,
} from "../controllers/hotel.controller.js";

const router = Router();

// Salud / test
router.get("/test", testConnection);

// Dashboard (cualquier autenticado)
router.get("/dashboard", verificarToken, obtenerDashboard);

// Fecha del sistema — compatible con config_routes.js antiguo (/api/config/fecha-sistema)
// y también con /api/fecha-sistema
router.get("/fecha-sistema", obtenerFechaSistema);
router.put("/fecha-sistema", verificarToken, soloAdmin, actualizarFechaSistema);

// Configuración hotel
router.get("/hotel/config", verificarToken, obtenerConfigHotel);
router.put("/hotel/config", verificarToken, soloAdmin, actualizarConfigHotel);

export default router;