// src/routes/reservas.routes.js
import { Router } from "express";
import {
  listarReservas,
  obtenerReserva,
  getCalendarioReservas,
  crearReserva,
  actualizarReserva,
  cancelarReserva,
  checkinReserva,
  checkoutReserva,
  obtenerDatosCheckIn,
  obtenerFinanzasReserva,
  facturarReserva,
  agregarCargoFactura,
  listarHabitacionesDisponibles
} from "../controllers/reservas.controller.js";

const router = Router();

/**
 * IMPORTANTE: el orden de las rutas SÍ importa.
 * Primero rutas fijas (como /calendario),
 * luego las que tienen más segmentos (/:id/finanzas),
 * y al final la más genérica (/:id).
 */

// 👉 Calendario / rack (la URL que usa CalendarioRack.jsx)
router.get("/calendario", getCalendarioReservas);

// Listado general de reservas
router.get("/", listarReservas);

router.get("/disponibles", listarHabitacionesDisponibles);

// Finanzas de la reserva
router.get("/:id/finanzas", obtenerFinanzasReserva);

// Datos para el modal de check-in
router.get("/:id/checkin/data", obtenerDatosCheckIn);

// Detalle simple por id (DEBE IR DESPUÉS DE LAS OTRAS CON :id)
router.get("/:id", obtenerReserva);

// Crear / actualizar / cancelar
router.post("/", crearReserva);
router.put("/:id", actualizarReserva);
router.delete("/:id", cancelarReserva);

// Check-in / check-out
router.post("/:id/checkin", checkinReserva);
router.post("/:id/checkout", checkoutReserva);

// Facturación
router.post("/:id/facturar", facturarReserva);

// Cargos adicionales sobre la factura
router.post("/:id/factura/cargos", agregarCargoFactura);

export default router;
