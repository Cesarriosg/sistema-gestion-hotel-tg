import { Router } from "express";
import { registrarConsumo } from "../controllers/serviciosConsumidos.controller.js";

const router = Router();

router.post("/consumir", registrarConsumo);

export default router;
