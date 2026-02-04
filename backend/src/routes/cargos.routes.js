import { Router } from "express";
import {
  listarCargosReserva,
  crearCargoReserva,
  anularCargo
} from "../controllers/cargos.controller.js";

const router = Router();

// cargos por reserva
router.get("/reservas/:id/cargos", listarCargosReserva);
router.post("/reservas/:id/cargos", crearCargoReserva);

// anular cargo
router.post("/:cargoId/anular", anularCargo)

export default router;
