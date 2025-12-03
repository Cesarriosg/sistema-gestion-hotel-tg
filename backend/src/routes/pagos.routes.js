// src/routes/pagos.routes.js
import { Router } from "express";
import { crearPago, listarPagosPorReserva } from "../controllers/pagos.controller.js";
import { verificarToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/", verificarToken, crearPago);
router.get("/reserva/:id", verificarToken, listarPagosPorReserva);

export default router;
