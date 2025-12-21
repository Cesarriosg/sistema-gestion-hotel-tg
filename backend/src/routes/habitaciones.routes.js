// src/routes/habitaciones.routes.js
import { Router } from "express";
import {
  listarHabitaciones,
  actualizarEstadoHabitacion,
} from "../controllers/habitaciones.controller.js";
import { verificarToken } from "../middlewares/authMiddleware.js";

const router = Router();

// Todas las rutas de habitaciones requieren usuario logueado
router.get("/", verificarToken, listarHabitaciones);
router.put("/:id/estado", verificarToken, actualizarEstadoHabitacion);

export default router;
