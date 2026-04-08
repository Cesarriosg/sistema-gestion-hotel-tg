// src/controllers/reportes.controller.js
import { pool } from "../config/database.js";
import dayjs from "dayjs";

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reportes/ocupacion?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// Ocupacion diaria: habitaciones ocupadas vs total, por dia del rango
// ─────────────────────────────────────────────────────────────────────────────
export const reporteOcupacion = async (req, res) => {
  const { desde, hasta } = req.query;

  const fechaDesde = desde || dayjs().subtract(30, "day").format("YYYY-MM-DD");
  const fechaHasta = hasta || dayjs().format("YYYY-MM-DD");

  try {
    // Total habitaciones activas
    const { rows: habRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM habitaciones WHERE activo = true`
    );
    const totalHab = habRows[0]?.total || 1;

    // Genera serie de fechas entre desde y hasta
    const { rows } = await pool.query(
      `
      WITH serie AS (
        SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS fecha
      ),
      ocupadas_por_dia AS (
        SELECT
          s.fecha,
          COUNT(r.id)::int AS habitaciones_ocupadas
        FROM serie s
        LEFT JOIN reservas r
          ON r.estado = 'ocupada'
          AND s.fecha >= r.fecha_inicio::date
          AND s.fecha <  r.fecha_fin::date
        GROUP BY s.fecha
      )
      SELECT
        fecha,
        habitaciones_ocupadas,
        $3::int AS total_habitaciones,
        ROUND((habitaciones_ocupadas::numeric / NULLIF($3, 0)) * 100, 1) AS porcentaje_ocupacion
      FROM ocupadas_por_dia
      ORDER BY fecha ASC
      `,
      [fechaDesde, fechaHasta, totalHab]
    );

    // Resumen del periodo
    const totalDias = rows.length;
    const promOcupacion =
      totalDias > 0
        ? Math.round(rows.reduce((s, r) => s + Number(r.porcentaje_ocupacion || 0), 0) / totalDias)
        : 0;
    const maxOcupacion = rows.length
      ? Math.max(...rows.map((r) => Number(r.porcentaje_ocupacion || 0)))
      : 0;

    res.json({
      desde: fechaDesde,
      hasta: fechaHasta,
      total_habitaciones: totalHab,
      promedio_ocupacion: promOcupacion,
      max_ocupacion: maxOcupacion,
      detalle: rows,
    });
  } catch (e) {
    console.error("reporteOcupacion error:", e);
    res.status(500).json({ message: "Error al generar reporte de ocupacion." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reportes/ingresos?desde=YYYY-MM-DD&hasta=YYYY-MM-DD&agrupar=dia|mes
// Ingresos reales (pagos tipo 'pago') agrupados por dia o mes
// ─────────────────────────────────────────────────────────────────────────────
export const reporteIngresos = async (req, res) => {
  const { desde, hasta, agrupar = "dia" } = req.query;

  const fechaDesde = desde || dayjs().subtract(30, "day").format("YYYY-MM-DD");
  const fechaHasta = hasta || dayjs().format("YYYY-MM-DD");

  try {
    let rows;

    if (agrupar === "mes") {
      const r = await pool.query(
        `
        SELECT
          TO_CHAR(DATE_TRUNC('month', p.created_at::date), 'YYYY-MM') AS periodo,
          COUNT(DISTINCT p.reserva_id)::int AS reservas,
          COALESCE(SUM(CASE WHEN p.tipo = 'pago'  THEN p.monto ELSE 0 END), 0)::numeric AS ingresos,
          COALESCE(SUM(CASE WHEN p.tipo = 'cargo' THEN p.monto ELSE 0 END), 0)::numeric AS cargos
        FROM pagos p
        WHERE p.created_at::date BETWEEN $1::date AND $2::date
        GROUP BY periodo
        ORDER BY periodo ASC
        `,
        [fechaDesde, fechaHasta]
      );
      rows = r.rows;
    } else {
      // agrupar por dia
      const r = await pool.query(
        `
        WITH serie AS (
          SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS fecha
        )
        SELECT
          s.fecha::text AS periodo,
          COUNT(DISTINCT p.reserva_id)::int AS reservas,
          COALESCE(SUM(CASE WHEN p.tipo = 'pago'  THEN p.monto ELSE 0 END), 0)::numeric AS ingresos,
          COALESCE(SUM(CASE WHEN p.tipo = 'cargo' THEN p.monto ELSE 0 END), 0)::numeric AS cargos
        FROM serie s
        LEFT JOIN pagos p
          ON p.created_at::date = s.fecha
        GROUP BY s.fecha
        ORDER BY s.fecha ASC
        `,
        [fechaDesde, fechaHasta]
      );
      rows = r.rows;
    }

    const totalIngresos = rows.reduce((s, r) => s + Number(r.ingresos || 0), 0);
    const totalCargos   = rows.reduce((s, r) => s + Number(r.cargos   || 0), 0);

    res.json({
      desde: fechaDesde,
      hasta: fechaHasta,
      agrupar,
      total_ingresos: totalIngresos,
      total_cargos:   totalCargos,
      detalle: rows,
    });
  } catch (e) {
    console.error("reporteIngresos error:", e);
    res.status(500).json({ message: "Error al generar reporte de ingresos." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reportes/huespedes-frecuentes?limite=20
// Huespedes con mas estadias registradas
// ─────────────────────────────────────────────────────────────────────────────
export const reporteHuespedesFrecuentes = async (req, res) => {
  const limite = Math.min(Number(req.query.limite) || 20, 100);

  try {
    const { rows } = await pool.query(
      `
      SELECT
        h.id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', h.nombres, h.primer_apellido, h.segundo_apellido)), ''),
          NULLIF(TRIM(h.nombre), ''),
          'Sin nombre'
        ) AS nombre_completo,
        h.tipo_documento,
        h.documento,
        h.email,
        h.telefono,
        h.nacionalidad,
        COUNT(r.id)::int                              AS total_estadias,
        MAX(r.fecha_inicio)::date                     AS ultima_estadia,
        MIN(r.fecha_inicio)::date                     AS primera_estadia,
        COALESCE(SUM(
          CASE WHEN p.tipo = 'pago' THEN p.monto ELSE 0 END
        ), 0)::numeric                                AS total_pagado
      FROM huespedes h
      JOIN reservas r
        ON r.huesped_id = h.id
        AND r.estado NOT IN ('cancelada')
      LEFT JOIN pagos p ON p.reserva_id = r.id
      GROUP BY h.id, h.nombres, h.primer_apellido, h.segundo_apellido,
               h.nombre, h.tipo_documento, h.documento,
               h.email, h.telefono, h.nacionalidad
      ORDER BY total_estadias DESC, total_pagado DESC
      LIMIT $1
      `,
      [limite]
    );

    res.json({ limite, total: rows.length, huespedes: rows });
  } catch (e) {
    console.error("reporteHuespedesFrecuentes error:", e);
    res.status(500).json({ message: "Error al generar reporte de huespedes frecuentes." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reportes/resumen?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
// KPIs de resumen para el rango: reservas, ingresos, ocupacion promedio
// ─────────────────────────────────────────────────────────────────────────────
export const reporteResumen = async (req, res) => {
  const { desde, hasta, fuente, tipo_habitacion } = req.query;

  const fechaDesde = desde || dayjs().subtract(30, "day").format("YYYY-MM-DD");
  const fechaHasta = hasta || dayjs().format("YYYY-MM-DD");

  try {
    const [habR, reservasR, ingresosR, noShowR, checkoutsR] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total FROM habitaciones WHERE activo = true`),

      pool.query(
        `SELECT
           COUNT(*)::int                                        AS total,
           COUNT(*) FILTER (WHERE r.estado = 'finalizada')::int AS finalizadas,
           COUNT(*) FILTER (WHERE r.estado = 'cancelada')::int  AS canceladas,
           COUNT(*) FILTER (WHERE r.estado = 'no_show')::int    AS no_shows
         FROM reservas r
         JOIN habitaciones h ON h.id = r.habitacion_id
         WHERE r.fecha_inicio::date BETWEEN $1::date AND $2::date
           AND ($3::text IS NULL OR r.fuente = $3)
           AND ($4::text IS NULL OR h.tipo = $4)`,
        [fechaDesde, fechaHasta, fuente || null, tipo_habitacion || null]
      ),

      pool.query(
        `SELECT COALESCE(SUM(monto), 0)::numeric AS total
         FROM pagos
         WHERE tipo = 'pago'
           AND created_at::date BETWEEN $1::date AND $2::date`,
        [fechaDesde, fechaHasta]
      ),

      pool.query(
        `SELECT COUNT(*)::int AS total
         FROM reservas
         WHERE estado = 'no_show'
           AND fecha_inicio::date BETWEEN $1::date AND $2::date`,
        [fechaDesde, fechaHasta]
      ),

      pool.query(
        `SELECT AVG(fecha_fin::date - fecha_inicio::date)::numeric AS estancia_promedio
         FROM reservas
         WHERE estado = 'finalizada'
           AND fecha_fin::date BETWEEN $1::date AND $2::date`,
        [fechaDesde, fechaHasta]
      ),
    ]);

    const totalHab = habR.rows[0]?.total || 1;
    const diasPeriodo = dayjs(fechaHasta).diff(dayjs(fechaDesde), "day") + 1;

    res.json({
      desde: fechaDesde,
      hasta: fechaHasta,
      dias_periodo: diasPeriodo,
      total_habitaciones: totalHab,
      reservas: {
        total:       reservasR.rows[0]?.total       || 0,
        finalizadas: reservasR.rows[0]?.finalizadas || 0,
        canceladas:  reservasR.rows[0]?.canceladas  || 0,
        no_shows:    noShowR.rows[0]?.total         || 0,
      },
      ingresos_periodo:   Number(ingresosR.rows[0]?.total || 0),
      estancia_promedio:  Number(checkoutsR.rows[0]?.estancia_promedio || 0).toFixed(1),
    });
  } catch (e) {
    console.error("reporteResumen error:", e);
    res.status(500).json({ message: "Error al generar resumen." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reportes/meta — Fuentes y tipos disponibles para filtros (RF-13)
// ─────────────────────────────────────────────────────────────────────────────
export const reporteMeta = async (req, res) => {
  try {
    const [fR, tR] = await Promise.all([
      pool.query(`SELECT DISTINCT fuente FROM reservas WHERE fuente IS NOT NULL ORDER BY fuente`),
      pool.query(`SELECT DISTINCT tipo FROM habitaciones WHERE activo = true ORDER BY tipo`),
    ]);
    res.json({
      fuentes: fR.rows.map(r => r.fuente),
      tipos:   tR.rows.map(r => r.tipo),
    });
  } catch (e) {
    console.error("reporteMeta error:", e);
    res.status(500).json({ message: "Error al obtener metadatos." });
  }
};

export const reporteHabitaciones = async (req, res) => {
  const { desde, hasta } = req.query;
  const fechaDesde = desde || dayjs().subtract(30, "day").format("YYYY-MM-DD");
  const fechaHasta = hasta || dayjs().format("YYYY-MM-DD");

  try {
    const { rows } = await pool.query(
      `SELECT
         h.id,
         h.numero,
         h.tipo,
         h.activo,
         COUNT(DISTINCT r.id) FILTER (WHERE r.fecha_inicio::date BETWEEN $1::date AND $2::date)::int AS total_reservas,
         COALESCE(SUM(
           GREATEST(0, (LEAST(r.fecha_fin::date, $2::date + 1) - GREATEST(r.fecha_inicio::date, $1::date)))
         ) FILTER (WHERE r.estado IN ('ocupada','finalizada')), 0)::int AS noches_ocupadas,
         COALESCE(SUM(p.monto) FILTER (WHERE p.tipo IN ('pago','deposito')), 0)::numeric AS ingresos_generados,
         (($2::date - $1::date) + 1) AS dias_periodo
       FROM habitaciones h
       LEFT JOIN reservas r ON r.habitacion_id = h.id
         AND r.estado IN ('ocupada','finalizada')
         AND r.fecha_inicio::date <= $2::date
         AND r.fecha_fin::date   >= $1::date
       LEFT JOIN pagos p ON p.reserva_id = r.id
       WHERE h.activo = true
       GROUP BY h.id, h.numero, h.tipo, h.activo
       ORDER BY h.numero ASC`,
      [fechaDesde, fechaHasta]
    );

    const diasPeriodo = rows[0]?.dias_periodo || 1;
    const result = rows.map(r => ({
      ...r,
      ocupacion_pct: diasPeriodo > 0
        ? Math.min(100, Math.round((r.noches_ocupadas / diasPeriodo) * 100))
        : 0,
    }));

    res.json({ desde: fechaDesde, hasta: fechaHasta, habitaciones: result });
  } catch (e) {
    console.error("reporteHabitaciones error:", e);
    res.status(500).json({ message: "Error al generar reporte por habitación." });
  }
};
