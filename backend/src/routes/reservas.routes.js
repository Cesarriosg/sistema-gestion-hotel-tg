import { Router } from "express";
import { crearReserva, listarReservas, obtenerReserva, actualizarReserva, cancelarReserva, checkinReserva, 
    checkoutReserva, obtenerReservasCalendario,getCalendarioReservas, obtenerDatosCheckIn, crearReservaOWalkIn,
    obtenerFinanzasReserva, facturarReserva
 } from "../controllers/reservas.controller.js";
import { verificarToken } from "../middlewares/authMiddleware.js";
const router = Router();

router.post("/", crearReserva);
router.get("/", listarReservas);
//router.get("/calendario", obtenerReservasCalendario);
router.get("/calendario", getCalendarioReservas);

router.put("/:id", actualizarReserva);
router.delete("/:id", cancelarReserva);
router.post("/:id/checkin", checkinReserva);
router.post("/:id/checkout", checkoutReserva);
router.get("/:id/checkin/data", obtenerDatosCheckIn);
router.post("/", crearReservaOWalkIn);
router.get("/:id/finanzas", verificarToken, obtenerFinanzasReserva);
router.post("/:id/facturar", verificarToken, facturarReserva);
router.get("/:id", obtenerReserva);




export default router;
