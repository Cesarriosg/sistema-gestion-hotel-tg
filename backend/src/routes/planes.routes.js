// src/routes/planes.routes.js
import { Router } from "express";
import { verificarToken, soloAdmin } from "../middlewares/authMiddleware.js";
import {
  listarPlanes,
  crearPlan,
  actualizarPlan,
  eliminarPlan,
} from "../controllers/planes.controller.js";

const router = Router();

router.get("/",       verificarToken,            listarPlanes);
router.post("/",      verificarToken, soloAdmin,  crearPlan);
router.put("/:codigo",verificarToken, soloAdmin,  actualizarPlan);
router.delete("/:codigo", verificarToken, soloAdmin, eliminarPlan);

export default router;
