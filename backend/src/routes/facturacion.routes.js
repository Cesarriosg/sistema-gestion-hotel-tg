// src/routes/facturacion.routes.js
import { Router } from "express";
import {
  listarFacturas,
  obtenerFactura,
  facturarReserva,
  listarPagos,
  registrarPago,
  anularFactura,
} from "../controllers/facturacion.controller.js";

const router = Router();

router.get("/facturas", listarFacturas);
router.get("/facturas/:id", obtenerFactura);

// se suele montar este en reservas.routes.js, pero por si acaso:
router.post("/reservas/:id/facturar", facturarReserva);

router.get("/pagos", listarPagos);
router.put("/facturas/:id/anular", anularFactura);
//router.post("/reservas/:id/pagos", registrarPago);

export default router;
