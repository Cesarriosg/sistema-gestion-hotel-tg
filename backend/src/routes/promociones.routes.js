// src/routes/promociones.routes.js
import { Router } from "express";
import { verificarToken, soloAdmin } from "../middlewares/authMiddleware.js";
import {
  listarPromociones,
  crearPromocion,
  actualizarPromocion,
  toggleActivaPromocion,
  eliminarPromocion,
} from "../controllers/promociones.controller.js";

const router = Router();

router.get("/",            verificarToken, listarPromociones);
router.post("/",           verificarToken, soloAdmin, crearPromocion);
router.put("/:id",         verificarToken, soloAdmin, actualizarPromocion);
router.patch("/:id/activa",verificarToken, soloAdmin, toggleActivaPromocion);
router.delete("/:id",      verificarToken, soloAdmin, eliminarPromocion);

export default router;
