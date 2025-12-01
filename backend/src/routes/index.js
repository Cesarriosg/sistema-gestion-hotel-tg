const express = require('express');
const router = express.Router();

const reservasRouter = require('./reservas');
// en el futuro: huespedes, habitaciones, facturas...
router.use('/reservas', reservasRouter);

module.exports = router;
