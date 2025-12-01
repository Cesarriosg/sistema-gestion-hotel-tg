import { Router } from "express";
import { registrarUsuario, login } from "../controllers/auth.controller.js";
import { verificarToken, soloAdmin } from "../middlewares/authMiddleware.js";

const router = Router();

// Solo administradores pueden crear usuarios
router.post("/register", registrarUsuario);

router.post("/login", login);

export default router;
