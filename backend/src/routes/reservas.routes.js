import { Router } from "express";
import { crearReserva, listarReservas, obtenerReserva, actualizarReserva, cancelarReserva, checkinReserva, 
    checkoutReserva, obtenerReservasCalendario,getCalendarioReservas, obtenerDatosCheckIn, crearReservaOWalkIn } from "../controllers/reservas.controller.js";
const router = Router();

router.post("/", crearReserva);
router.get("/", listarReservas);
//router.get("/calendario", obtenerReservasCalendario);
router.get("/calendario", getCalendarioReservas);
router.get("/:id", obtenerReserva);
router.put("/:id", actualizarReserva);
router.delete("/:id", cancelarReserva);
router.post("/:id/checkin", checkinReserva);
router.post("/:id/checkout", checkoutReserva);
router.get("/:id/checkin/data", obtenerDatosCheckIn);
router.post("/", crearReservaOWalkIn);




export default router;
