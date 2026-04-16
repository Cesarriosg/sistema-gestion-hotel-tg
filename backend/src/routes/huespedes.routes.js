// src/routes/huespedes.routes.js
import { Router } from "express";
import {
  listarHuespedesFiltrados,
  obtenerHuesped,
  crearHuesped,
  actualizarHuesped,
  buscarHuespedPorDocumento,
  historialHuesped,
  pagosPorHuesped,
} from "../controllers/huespedes.controller.js";
import { verificarToken } from "../middlewares/authMiddleware.js";

const router = Router();

// ── Estáticas — SIEMPRE antes de /:id ────────────────────────────────────────
router.get("/buscar", verificarToken, buscarHuespedPorDocumento);
router.get("/",       verificarToken, listarHuespedesFiltrados);

// ── Con parámetro /:id ────────────────────────────────────────────────────────
router.get("/:id/estadias",  verificarToken, historialHuesped);
router.get("/:id/historial", verificarToken, historialHuesped);
router.get("/:id/pagos",    verificarToken, pagosPorHuesped);
router.get("/:id",           verificarToken, obtenerHuesped);
router.post("/",            verificarToken, crearHuesped);
router.put("/:id",          verificarToken, actualizarHuesped);

export default router;