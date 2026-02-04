import { Router } from "express";
import { crearBloqueo, eliminarBloqueo, getCalendarioBloqueos } from "../controllers/bloqueos.controller.js";

const router = Router();

router.get("/calendario", getCalendarioBloqueos);
router.post("/", crearBloqueo);
router.delete("/:id", eliminarBloqueo);

export default router;
