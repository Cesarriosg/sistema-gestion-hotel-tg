// src/routes/huespedes.routes.js
import { Router } from "express";
import {
  listarHuespedes,
  obtenerHuesped,
  crearHuesped,
  actualizarHuesped,
} from "../controllers/huespedes.controller.js";
// Si quieres protegerlas:
// import { verificarToken } from "../middlewares/authMiddleware.js";

const router = Router();

// Por simplicidad, sin auth en backend (igual el frontend ya usa PrivateRoute)
router.get("/", listarHuespedes);
router.get("/:id", obtenerHuesped);
router.post("/", crearHuesped);
router.put("/:id", actualizarHuesped);

export default router;
