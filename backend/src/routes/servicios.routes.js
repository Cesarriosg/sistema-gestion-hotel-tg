// src/routes/servicios.routes.js — RF-20: Catálogo de servicios adicionales
import { Router } from "express";
import { verificarToken } from "../middlewares/authMiddleware.js";
import {
  listarServicios,
  obtenerServicio,
  crearServicio,
  actualizarServicio,
  eliminarServicio,
} from "../controllers/servicios.controller.js";

const router = Router();

router.get("/",    verificarToken, listarServicios);
router.get("/:id", verificarToken, obtenerServicio);
router.post("/",   verificarToken, crearServicio);
router.put("/:id", verificarToken, actualizarServicio);
router.delete("/:id", verificarToken, eliminarServicio);

export default router;