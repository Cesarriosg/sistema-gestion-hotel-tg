// src/routes/auditoria.routes.js
import express from "express";
import {
  listarHabitacionesOcupadas,
  previewAlojamiento,
  generarCargosAlojamiento,
  cierreDelDia,
} from "../controllers/auditoria.controller.js";

const router = express.Router();

router.get("/ocupadas", listarHabitacionesOcupadas);
router.get("/preview-alojamiento", previewAlojamiento);
router.post("/generar-alojamiento", generarCargosAlojamiento);
router.post("/cierre-dia", cierreDelDia);

export default router;
