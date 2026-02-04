// src/routes/usuarios.routes.js
import { Router } from "express";
import { verificarToken } from "../middlewares/authMiddleware.js";
import {
  listarUsuarios,
  crearUsuario,
  actualizarUsuario,
  cambiarEstadoUsuario,
  resetPasswordUsuario,
  eliminarUsuario,
} from "../controllers/usuarios.controller.js";

const router = Router();

router.get("/", verificarToken, listarUsuarios);
router.post("/", verificarToken, crearUsuario);
router.put("/:id", verificarToken, actualizarUsuario);
router.patch("/:id/estado", verificarToken, cambiarEstadoUsuario);
router.patch("/:id/reset-password", verificarToken, resetPasswordUsuario);
router.delete("/:id", verificarToken, eliminarUsuario);

export default router;
