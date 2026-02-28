// src/routes/huespedes.routes.js
import { Router } from "express";
import {
  listarHuespedes,
  obtenerHuesped,
  crearHuesped,
  actualizarHuesped,
  buscarHuespedPorDocumento,
  obtenerEstadiasHuesped,
} from "../controllers/huespedes.controller.js";
import { verificarToken } from "../middlewares/authMiddleware.js";

const router = Router();

// ── Estáticas — SIEMPRE antes de /:id ────────────────────────────────────────
router.get("/buscar", verificarToken, buscarHuespedPorDocumento);
router.get("/",       verificarToken, listarHuespedes);

// ── Con parámetro /:id ────────────────────────────────────────────────────────
router.get("/:id/estadias", verificarToken, obtenerEstadiasHuesped);
router.get("/:id",          verificarToken, obtenerHuesped);
router.post("/",            verificarToken, crearHuesped);
router.put("/:id",          verificarToken, actualizarHuesped);

export default router;