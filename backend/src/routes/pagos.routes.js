// src/routes/pagos.routes.js
import { Router } from "express";
import {
  crearPago,
  listarPagosPorReserva,
 // registrarPago
} from "../controllers/pagos.controller.js";

const router = Router();

// OJO: SIN verificarToken para evitar el 401 mientras tanto
router.post("/", crearPago);
router.get("/reserva/:id", listarPagosPorReserva);
//router.post("/pagos", registrarPago);

export default router;
