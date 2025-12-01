import { Router } from "express";
import { crearHuesped, listarHuespedes, obtenerHuesped, actualizarHuesped, eliminarHuesped, buscarHuespedPorDocumento } from "../controllers/huespedes.controller.js";
const router = Router();

router.post("/", crearHuesped);
router.get("/", listarHuespedes);
router.get("/:id", obtenerHuesped);
router.put("/:id", actualizarHuesped);
router.delete("/:id", eliminarHuesped);
router.get("/buscar/:documento", buscarHuespedPorDocumento);


export default router;
