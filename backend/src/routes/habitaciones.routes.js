// src/routes/habitaciones.routes.js
import { Router } from "express";
import { verificarToken } from "../middlewares/authMiddleware.js";
import {
  listarHabitaciones,
  actualizarEstadoHabitacion,
  obtenerHabitacionPorNumero,
  crearHabitacion,
  actualizarTipoHabitacionDeHab,
  cambiarActivoHabitacion,
  actualizarPlanYTarifaHabitacion
} from "../controllers/habitaciones.controller.js";

const router = Router();

router.get("/", verificarToken, listarHabitaciones);

// fijas
router.get("/por-numero/:numero", verificarToken, obtenerHabitacionPorNumero);

// admin
router.post("/", verificarToken, crearHabitacion);
router.put("/:id/tipo", verificarToken, actualizarTipoHabitacionDeHab);
router.put("/:id/activo", verificarToken, cambiarActivoHabitacion);
router.put("/:id/plan-tarifa", verificarToken, actualizarPlanYTarifaHabitacion);

// estado operativo
router.put("/:id/estado", verificarToken, actualizarEstadoHabitacion);

export default router;
