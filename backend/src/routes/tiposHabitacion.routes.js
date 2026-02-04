import { Router } from "express";
import { verificarToken } from "../middlewares/authMiddleware.js";
import {
  listarTiposHabitacion,
  crearTipoHabitacion,
  actualizarTipoHabitacion,
  cambiarEstadoTipoHabitacion,
} from "../controllers/tiposHabitacion.controller.js";

const router = Router();

router.get("/", verificarToken, listarTiposHabitacion);
router.post("/", verificarToken, crearTipoHabitacion);
router.put("/:id", verificarToken, actualizarTipoHabitacion);
router.patch("/:id/estado", verificarToken, cambiarEstadoTipoHabitacion);

export default router;
