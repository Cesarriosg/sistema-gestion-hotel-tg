// src/routes/reservas.routes.js
import { Router } from "express";
import {
  listarReservas,
  getCalendarioReservas,
  crearReservaOWalkIn,
  obtenerReserva,
  actualizarReserva,
  cancelarReserva,
  checkinReserva,
  checkoutReserva,
  obtenerDatosCheckIn,
  obtenerFinanzasReserva,
  previsualizarPrecioReserva,
  listarHuespedesDeReserva,
  obtenerHuespedesAsociadosReserva,
  actualizarAcompanantesReserva,
} from "../controllers/reservas.controller.js";

import { registrarPago } from "../controllers/facturacion.controller.js";

const router = Router();

// Calendario / rack
router.get("/calendario", getCalendarioReservas);

// ✅ Precio preview
router.get("/previsualizarPrecioReserva", previsualizarPrecioReserva);

// ✅ Datos check-in
router.get("/:id/checkin/data", obtenerDatosCheckIn);

// ✅ Finanzas
router.get("/:id/finanzas", obtenerFinanzasReserva);

router.post("/:id/pagos", registrarPago)

// ✅ (si usas esta ruta en algún lado, déjala)
router.get("/:id/huespedes", listarHuespedesDeReserva);

// ✅ NUEVO: asociados (titular + acompañantes)
router.get("/:id/huespedes-asociados", obtenerHuespedesAsociadosReserva);

// ✅ NUEVO: actualizar acompañantes
router.put("/:id/acompanantes", actualizarAcompanantesReserva);

// Listado + crear
router.get("/", listarReservas);
router.post("/", crearReservaOWalkIn);

router.get("/:id", obtenerReserva);
router.put("/:id", actualizarReserva);
router.delete("/:id", cancelarReserva);

router.post("/:id/checkin", checkinReserva);
router.post("/:id/checkout", checkoutReserva);

export default router;
