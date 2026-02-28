// src/routes/reservas.routes.js
import { Router } from "express";
import {
  generarRegistroHotelero,
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
  listarHabitacionesDisponibles,
  listarHuespedesDeReserva,
  obtenerHuespedesAsociadosReserva,
  actualizarAcompanantesReserva,
  listarLlegadasDelDia,      
  marcarNoShow,              
  extenderEstadia,           
  obtenerHistorialReserva,   
} from "../controllers/reservas.controller.js";

import { registrarPago } from "../controllers/facturacion.controller.js";

const router = Router();

// Rutas ESTÁTICAS 

router.get("/calendario",                getCalendarioReservas);
router.get("/precio",                    previsualizarPrecioReserva);
router.get("/previsualizarPrecioReserva",previsualizarPrecioReserva);
router.get("/disponibles",               listarHabitacionesDisponibles);
router.get("/llegadas",                  listarLlegadasDelDia);     
router.get("/",                          listarReservas);

//  Rutas  /:id 

router.get("/:id/checkin/data",          obtenerDatosCheckIn);
router.get("/:id/finanzas",              obtenerFinanzasReserva);
router.get("/:id/huespedes",             listarHuespedesDeReserva);
router.get("/:id/huespedes-asociados",   obtenerHuespedesAsociadosReserva);
router.get("/:id/historial",             obtenerHistorialReserva);   // HU-R11
router.get("/:id/registro-hotelero",     generarRegistroHotelero);   // PDF
router.get("/:id",                       obtenerReserva);

router.post("/",                         crearReservaOWalkIn);
router.post("/:id/pagos",                registrarPago);
router.post("/:id/checkin",              checkinReserva);
router.post("/:id/checkout",             checkoutReserva);
router.post("/:id/no-show",              marcarNoShow);              
router.post("/:id/extender",             extenderEstadia);          

router.put("/:id/acompanantes",          actualizarAcompanantesReserva);
router.put("/:id",                       actualizarReserva);

router.delete("/:id",                    cancelarReserva);

export default router;