// src/routes/servicios_consumidos.routes.js
import { Router } from "express";
import { verificarToken } from "../middlewares/authMiddleware.js";
import {
  listarConsumos,
  registrarConsumo,
  eliminarConsumo,
} from "../controllers/serviciosConsumidos.controller.js";

const router = Router();

router.get("/:reservaId",  verificarToken, listarConsumos);
router.post("/",           verificarToken, registrarConsumo);
router.delete("/:id",      verificarToken, eliminarConsumo);

export default router;