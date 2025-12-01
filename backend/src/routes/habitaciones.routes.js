import { Router } from "express";
import { crearHabitacion, listarHabitaciones, obtenerHabitacion, actualizarHabitacion, listarDisponibles } from "../controllers/habitaciones.controller.js";
const router = Router();

router.post("/", crearHabitacion);
router.get("/", listarHabitaciones);
router.get("/disponibles", listarDisponibles )
router.get("/:id", obtenerHabitacion);
router.put("/:id", actualizarHabitacion);


export default router;
