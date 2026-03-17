// src/routes/tarifas.routes.js
import { Router } from "express";
import { verificarToken, soloAdmin } from "../middlewares/authMiddleware.js";
import {
  listarPlanes,
  listarTarifas,
  obtenerTarifa,
  crearTarifa,
  actualizarTarifa,
  eliminarTarifa,
  resumenTarifas,
} from "../controllers/tarifas.controller.js";

const router = Router();

// Rutas estáticas ANTES de /:id para evitar conflictos
router.get("/planes",  verificarToken, listarPlanes);   // GET /api/tarifas/planes
router.get("/resumen", verificarToken, resumenTarifas); // GET /api/tarifas/resumen
router.get("/",        verificarToken, listarTarifas);  // GET /api/tarifas
router.get("/:id",     verificarToken, obtenerTarifa);  // GET /api/tarifas/:id

router.post("/",       verificarToken, soloAdmin, crearTarifa);
router.put("/:id",     verificarToken, soloAdmin, actualizarTarifa);
router.delete("/:id",  verificarToken, soloAdmin, eliminarTarifa);

export default router;