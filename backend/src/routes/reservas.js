const express = require('express');
const router = express.Router();
const { Reserva, Habitacion, Huesped } = require('../models');

// Crear reserva (HU-R1)
router.post('/', async (req, res) => {
  try {
    const { fechaInicio, fechaFin, habitacionId, huespedId, notas } = req.body;
    if (!fechaInicio || !fechaFin || !habitacionId || !huespedId) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }
    // crear reserva
    const reserva = await Reserva.create({ fechaInicio, fechaFin, habitacionId, huespedId, notas, estado: 'confirmada' });
    // marcar habitación ocupada (simplificado)
    await Habitacion.update({ estado: 'ocupada' }, { where: { id: habitacionId }});
    res.status(201).json(reserva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando reserva' });
  }
});

// Listar reservas
router.get('/', async (req, res) => {
  try {
    const { estado } = req.query;
    const where = {};
    if (estado) where.estado = estado;
    const reservas = await Reserva.findAll({ include: [Huesped, Habitacion], where, order: [['fechaInicio','ASC']]});
    res.json(reservas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error listando reservas' });
  }
});

// Obtener reserva por id
router.get('/:id', async (req, res) => {
  try {
    const reserva = await Reserva.findByPk(req.params.id, { include: [Huesped, Habitacion] });
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    res.json(reserva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error obteniendo reserva' });
  }
});

// Actualizar reserva
router.put('/:id', async (req, res) => {
  try {
    const reserva = await Reserva.findByPk(req.params.id);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    await reserva.update(req.body);
    res.json(reserva);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando reserva' });
  }
});

// Cancelar reserva
router.delete('/:id', async (req, res) => {
  try {
    const reserva = await Reserva.findByPk(req.params.id);
    if (!reserva) return res.status(404).json({ error: 'Reserva no encontrada' });
    await reserva.update({ estado: 'cancelada' });
    await Habitacion.update({ estado: 'disponible' }, { where: { id: reserva.habitacionId }});
    res.json({ message: 'Reserva cancelada' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cancelando reserva' });
  }
});

module.exports = router;
