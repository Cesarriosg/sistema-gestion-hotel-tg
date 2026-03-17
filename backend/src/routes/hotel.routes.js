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

// Test
router.get("/test",      testConnection);

// Dashboard (todos los autenticados)
router.get("/dashboard", verificarToken, obtenerDashboard);

// Fecha operativa (compatible con /api/fecha-sistema)
router.get("/fecha-sistema", obtenerFechaSistema);
router.put("/fecha-sistema", verificarToken, soloAdmin, actualizarFechaSistema);

// Config hotel
router.get("/hotel/config", verificarToken, obtenerConfigHotel);
router.put("/hotel/config", verificarToken, soloAdmin, actualizarConfigHotel);

export default router;