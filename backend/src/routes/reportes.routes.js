// src/routes/reportes.routes.js
import { Router } from "express";
import { verificarToken } from "../middlewares/authMiddleware.js";
import {
  reporteOcupacion,
  reporteIngresos,
  reporteHuespedesFrecuentes,
  reporteResumen,
  reporteMeta,
} from "../controllers/reportes.controller.js";

const router = Router();

router.get("/resumen",              verificarToken, reporteResumen);
router.get("/ocupacion",            verificarToken, reporteOcupacion);
router.get("/ingresos",             verificarToken, reporteIngresos);
router.get("/huespedes-frecuentes", verificarToken, reporteHuespedesFrecuentes);

router.get("/meta", verificarToken, reporteMeta);

export default router;