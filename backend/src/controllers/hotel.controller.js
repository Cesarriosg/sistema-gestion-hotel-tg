
import { pool } from "../config/database.js";
import dayjs from "dayjs";


// GET /api/hotel/config

export const obtenerConfigHotel = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, nombre, direccion, ciudad, telefono, email, nit,
              fecha_sistema, created_at, updated_at
       FROM configuracion LIMIT 1`
    );
    if (!rows.length) return res.status(404).json({ message: "Configuración no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerConfigHotel error:", e);
    res.status(500).json({ message: "Error al obtener configuración." });
  }
};


// PUT /api/hotel/config

export const actualizarConfigHotel = async (req, res) => {
  const { nombre, direccion, ciudad, telefono, email, nit } = req.body;
  if (!nombre?.trim()) return res.status(400).json({ message: "El nombre del hotel es obligatorio." });

  try {
    const { rows } = await pool.query(`
      UPDATE configuracion SET
        nombre    = $1,
        direccion = $2,
        ciudad    = $3,
        telefono  = $4,
        email     = $5,
        nit       = $6,
        updated_at = NOW()
      RETURNING id, nombre, direccion, ciudad, telefono, email, nit, fecha_sistema, updated_at
    `, [
      nombre.trim(),
      direccion?.trim() || null,
      ciudad?.trim()    || null,
      telefono?.trim()  || null,
      email?.trim()     || null,
      nit?.trim()       || null,
    ]);
    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarConfigHotel error:", e);
    res.status(500).json({ message: "Error al actualizar configuración." });
  }
};


// GET /api/hotel/fecha-sistema

export const obtenerFechaSistema = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
    res.json({ fecha: rows[0]?.fecha_sistema || dayjs().format("YYYY-MM-DD") });
  } catch (e) {
    console.error("obtenerFechaSistema error:", e);
    res.status(500).json({ message: "Error al obtener fecha del sistema." });
  }
};


// PUT /api/hotel/fecha-sistema  (solo admin)

export const actualizarFechaSistema = async (req, res) => {
  const { nueva_fecha } = req.body;
  if (!nueva_fecha) return res.status(400).json({ message: "Debe proporcionar una nueva fecha." });

  try {
    await pool.query("UPDATE configuracion SET fecha_sistema = $1", [nueva_fecha]);
    res.json({ message: "Fecha del sistema actualizada.", fecha: nueva_fecha });
  } catch (e) {
    console.error("actualizarFechaSistema error:", e);
    res.status(500).json({ message: "Error al actualizar la fecha." });
  }
};


// GET /api/hotel/dashboard — KPIs del día operativo

export const obtenerDashboard = async (req, res) => {
  try {
    const { rows: cfgRows } = await pool.query(
      "SELECT fecha_sistema FROM configuracion LIMIT 1"
    );
    const hoy = dayjs(cfgRows[0]?.fecha_sistema || new Date()).format("YYYY-MM-DD");
    const manana = dayjs(hoy).add(1, "day").format("YYYY-MM-DD");

    // Total habitaciones activas
    const { rows: habRows } = await pool.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE estado = 'disponible')::int AS disponibles,
              COUNT(*) FILTER (WHERE estado = 'ocupada')::int AS ocupadas,
              COUNT(*) FILTER (WHERE estado = 'reservada')::int AS reservadas,
              COUNT(*) FILTER (WHERE estado IN ('mantenimiento','fuera_servicio'))::int AS fuera
       FROM habitaciones WHERE activo = true`
    );

    // Llegadas de hoy (reservadas con fecha_inicio = hoy)
    const { rows: llegadasRows } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM reservas
      WHERE estado = 'reservada'
        AND fecha_inicio::date = $1::date
    `, [hoy]);

    // Salidas de hoy (ocupadas con fecha_fin = hoy)
    const { rows: salidasRows } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM reservas
      WHERE estado = 'ocupada'
        AND fecha_fin::date = $1::date
    `, [hoy]);

    // Ingresos del día (pagos reales — tipo pago, no cargo)
    const { rows: ingresosRows } = await pool.query(`
      SELECT COALESCE(SUM(monto), 0)::numeric AS total
      FROM pagos
      WHERE tipo = 'pago'
        AND fecha::date = $1::date
    `, [hoy]);

    // Reservas por estado general
    const { rows: estadosRows } = await pool.query(`
      SELECT estado, COUNT(*)::int AS cantidad
      FROM reservas
      WHERE estado NOT IN ('cancelada')
      GROUP BY estado
    `);

    // Huéspedes en casa (ocupadas que incluyen hoy)
    const { rows: huespRows } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM reservas
      WHERE estado = 'ocupada'
        AND $1::date >= fecha_inicio::date
        AND $1::date < fecha_fin::date
    `, [hoy]);

    // No-shows del día
    const { rows: noShowRows } = await pool.query(`
      SELECT COUNT(*)::int AS total
      FROM reservas
      WHERE estado = 'no_show'
        AND fecha_inicio::date = $1::date
    `, [hoy]);

    const hab = habRows[0] || {};
    const porcentajeOcupacion = hab.total > 0
      ? Math.round((hab.ocupadas / hab.total) * 100)
      : 0;

    res.json({
      fecha_operativa: hoy,
      habitaciones: {
        total:       hab.total       || 0,
        disponibles: hab.disponibles || 0,
        ocupadas:    hab.ocupadas    || 0,
        reservadas:  hab.reservadas  || 0,
        fuera:       hab.fuera       || 0,
        porcentaje_ocupacion: porcentajeOcupacion,
      },
      llegadas_hoy:  llegadasRows[0]?.total  || 0,
      salidas_hoy:   salidasRows[0]?.total   || 0,
      huespedes_casa: huespRows[0]?.total    || 0,
      no_shows_hoy:  noShowRows[0]?.total    || 0,
      ingresos_hoy:  Number(ingresosRows[0]?.total || 0),
      reservas_por_estado: estadosRows,
    });
  } catch (e) {
    console.error("obtenerDashboard error:", e);
    res.status(500).json({ message: "Error al obtener datos del dashboard." });
  }
};

// Mantener compatibilidad con el import original
export const testConnection = async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ mensaje: "Conexión exitosa con el backend y la BD 🏨", horaServidorBD: result.rows[0].now });
  } catch (error) {
    res.status(500).json({ error: "Error al consultar la BD", detalle: error.message });
  }
};