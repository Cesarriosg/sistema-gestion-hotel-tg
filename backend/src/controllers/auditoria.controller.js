import dayjs from "dayjs";
import { pool } from "../config/database.js";
import { calcularTotalAlojamiento } from "./facturacion.controller.js";

// helper: fecha operativa desde configuracion
export const getFechaOperativa = async (client) => {
  const r = await client.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
  const fecha = r.rows?.[0]?.fecha_sistema;
  return dayjs(fecha || new Date()).format("YYYY-MM-DD");
};

/**
 * GET /api/auditoria/ocupadas
 * Lista reservas ocupadas cuyo rango incluye la fecha operativa [inicio, fin)
 */
export const listarHabitacionesOcupadas = async (req, res) => {
  const client = await pool.connect();
  try {
    const fechaOperativa = await getFechaOperativa(client);

    const q = await client.query(
      `
      SELECT
        r.id AS reserva_id,
        r.fecha_inicio,
        r.fecha_fin,
        r.plan,
        r.estado,
        h.numero AS habitacion_numero,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS huesped
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.estado = 'ocupada'
        AND $1::date >= r.fecha_inicio::date
        AND $1::date <  r.fecha_fin::date
      ORDER BY h.numero ASC
      `,
      [fechaOperativa]
    );

    return res.json(q.rows || []);
  } catch (e) {
    console.error("listarHabitacionesOcupadas error:", e);
    return res.status(500).json({ message: "Error obteniendo habitaciones ocupadas." });
  } finally {
    client.release();
  }
};

/**
 * GET /api/auditoria/preview-alojamiento
 * Calcula cuánto se va a cobrar HOY por alojamiento y marca:
 * - pendiente (si aún no existe cargo auditoría hoy)
 * - saltado (si ya existe)
 */
export const previewAlojamiento = async (req, res) => {
  const client = await pool.connect();
  try {
    const fechaOperativa = await getFechaOperativa(client);
    const fechaFinDia = dayjs(fechaOperativa).add(1, "day").format("YYYY-MM-DD");

    const occ = await client.query(
      `
      SELECT
        r.id AS reserva_id,
        r.plan,
        r.habitacion_id,
        r.fecha_inicio,
        r.fecha_fin,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS huesped
      FROM reservas r
      JOIN habitaciones h   ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.estado = 'ocupada'
        AND $1::date >= r.fecha_inicio::date
        AND $1::date <  r.fecha_fin::date
      ORDER BY h.numero ASC
      `,
      [fechaOperativa]
    );

    const ocupadas = occ.rows || [];
    if (!ocupadas.length) {
      return res.json({
        fechaOperativa,
        totalHabitaciones: 0,
        resumen: [],
        message: "No hay habitaciones ocupadas para la fecha operativa.",
      });
    }

    const resumen = [];
    for (const r of ocupadas) {
      const plan = (r.plan || "C1").trim();

      // ¿ya existe cargo de auditoría HOY?
      const existe = await client.query(
        `
        SELECT id
        FROM pagos
        WHERE reserva_id = $1
          AND tipo = 'cargo'
          AND metodo = 'otro'
          AND fecha = $2::date
          AND referencia ILIKE 'AUDITORIA ALOJAMIENTO%'
        LIMIT 1
        `,
        [r.reserva_id, fechaOperativa]
      );

      const { total: totalDia } = await calcularTotalAlojamiento(client, {
        plan,
        tipoHabitacion: r.habitacion_tipo,
        fechaInicio: fechaOperativa,
        fechaFin: fechaFinDia,
      });

      const total = Number(totalDia || 0);

      if (existe.rows.length) {
        resumen.push({
          reserva_id: r.reserva_id,
          habitacion_numero: r.habitacion_numero,
          habitacion_tipo: r.habitacion_tipo,
          huesped: r.huesped,
          plan,
          fecha: fechaOperativa,
          total: 0,
          estado: "saltado",
          motivo: "Ya existe cargo de auditoría para esta fecha",
        });
      } else {
        resumen.push({
          reserva_id: r.reserva_id,
          habitacion_numero: r.habitacion_numero,
          habitacion_tipo: r.habitacion_tipo,
          huesped: r.huesped,
          plan,
          fecha: fechaOperativa,
          total,
          estado: "pendiente",
          motivo: "",
        });
      }
    }

    return res.json({
      fechaOperativa,
      totalHabitaciones: ocupadas.length,
      resumen,
    });
  } catch (e) {
    console.error("previewAlojamiento error:", e);
    return res.status(500).json({ message: e.message || "Error generando preview." });
  } finally {
    client.release();
  }
};

/**
 * POST /api/auditoria/generar-alojamiento
 * Genera cargos de alojamiento del día operativo para TODAS las ocupadas.
 *  Idempotente: si ya existe (reserva_id + fecha + referencia AUDITORIA), NO lo duplica.
 */
export const generarCargosAlojamiento = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const fechaOperativa = await getFechaOperativa(client);
    const fechaFinDia = dayjs(fechaOperativa).add(1, "day").format("YYYY-MM-DD");

    const occ = await client.query(
      `
      SELECT
        r.id AS reserva_id,
        r.plan,
        r.habitacion_id,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS huesped
      FROM reservas r
      JOIN habitaciones h   ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.estado = 'ocupada'
        AND $1::date >= r.fecha_inicio::date
        AND $1::date <  r.fecha_fin::date
      ORDER BY h.numero ASC
      `,
      [fechaOperativa]
    );

    const ocupadas = occ.rows || [];
    if (!ocupadas.length) {
      await client.query("COMMIT");
      return res.json({
        fechaOperativa,
        totalHabitaciones: 0,
        generados: 0,
        saltados: 0,
        resumen: [],
        message: "No hay habitaciones ocupadas para la fecha operativa.",
      });
    }

    const resumen = [];
    let generados = 0;
    let saltados = 0;

    for (const r of ocupadas) {
      const plan = (r.plan || "C1").trim();

      // anti-duplicado (por reserva + fecha del cargo)
      const existe = await client.query(
        `
        SELECT id
        FROM pagos
        WHERE reserva_id = $1
          AND tipo = 'cargo'
          AND metodo = 'otro'
          AND fecha = $2::date
          AND referencia ILIKE 'AUDITORIA ALOJAMIENTO%'
        LIMIT 1
        `,
        [r.reserva_id, fechaOperativa]
      );

      if (existe.rows.length) {
        saltados += 1;
        resumen.push({
          reserva_id: r.reserva_id,
          habitacion_numero: r.habitacion_numero,
          habitacion_tipo: r.habitacion_tipo,
          huesped: r.huesped,
          plan,
          fecha: fechaOperativa,
          total: 0,
          estado: "saltado",
          motivo: "Ya existe cargo de auditoría para esta fecha",
        });
        continue;
      }

      const { total: totalDia } = await calcularTotalAlojamiento(client, {
        plan,
        tipoHabitacion: r.habitacion_tipo,
        fechaInicio: fechaOperativa,
        fechaFin: fechaFinDia,
      });

      const total = Number(totalDia || 0);

      await client.query(
        `
        INSERT INTO pagos (reserva_id, tipo, metodo, monto, referencia, fecha, created_at)
        VALUES ($1, 'cargo', 'otro', $2, $3, $4::date, NOW())
        `,
        [
          r.reserva_id,
          "cargo",
          "otro",
          total,
          `AUDITORIA ALOJAMIENTO ${fechaOperativa} - Hab ${r.habitacion_numero} - Plan ${plan}`,
          fechaOperativa,
        ]
      );

      generados += 1;
      resumen.push({
        reserva_id: r.reserva_id,
        habitacion_numero: r.habitacion_numero,
        habitacion_tipo: r.habitacion_tipo,
        huesped: r.huesped,
        plan,
        fecha: fechaOperativa,
        total,
        estado: "generado",
        motivo: "",
      });
    }

    await client.query("COMMIT");

    return res.json({
      fechaOperativa,
      totalHabitaciones: ocupadas.length,
      generados,
      saltados,
      resumen,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("generarCargosAlojamiento error:", e);
    return res.status(500).json({ message: e.message || "Error ejecutando auditoría." });
  } finally {
    client.release();
  }
};

/**
 * POST /api/auditoria/cierre-dia
 * 1) ejecuta auditoría alojamiento
 * 2) avanza fecha operativa +1
 */
export const cierreDelDia = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) ejecutar auditoría (reutilizamos la lógica aquí mismo)
    const fechaOperativa = await getFechaOperativa(client);

    const resp = await (async () => {
      const fechaFinDia = dayjs(fechaOperativa).add(1, "day").format("YYYY-MM-DD");

      const occ = await client.query(
        `
        SELECT
          r.id AS reserva_id,
          r.plan,
          h.numero AS habitacion_numero,
          h.tipo   AS habitacion_tipo,
          COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
            NULLIF(TRIM(hu.nombre), ''),
            ''
          ) AS huesped
        FROM reservas r
        JOIN habitaciones h   ON h.id = r.habitacion_id
        LEFT JOIN huespedes hu ON hu.id = r.huesped_id
        WHERE r.estado = 'ocupada'
          AND $1::date >= r.fecha_inicio::date
          AND $1::date <  r.fecha_fin::date
        ORDER BY h.numero ASC
        `,
        [fechaOperativa]
      );

      const ocupadas = occ.rows || [];
      const resumen = [];
      let generados = 0;
      let saltados = 0;

      for (const r of ocupadas) {
        const plan = (r.plan || "C1").trim();

        const existe = await client.query(
          `
          SELECT id
          FROM pagos
          WHERE reserva_id = $1
            AND tipo = 'cargo'
            AND metodo = 'otro'
            AND fecha = $2::date
            AND referencia ILIKE 'AUDITORIA ALOJAMIENTO%'
          LIMIT 1
          `,
          [r.reserva_id, fechaOperativa]
        );

        if (existe.rows.length) {
          saltados++;
          resumen.push({
            reserva_id: r.reserva_id,
            habitacion_numero: r.habitacion_numero,
            huesped: r.huesped,
            plan,
            fecha: fechaOperativa,
            total: 0,
            estado: "saltado",
            motivo: "Ya existe cargo de auditoría para esta fecha",
          });
          continue;
        }

        const { total: totalDia } = await calcularTotalAlojamiento(client, {
          plan,
          tipoHabitacion: r.habitacion_tipo,
          fechaInicio: fechaOperativa,
          fechaFin: fechaFinDia,
        });

        const total = Number(totalDia || 0);

        await client.query(
          `
          INSERT INTO pagos (reserva_id, tipo, metodo, monto, referencia, fecha, created_at)
          VALUES ($1, 'cargo', 'otro', $2, $3, $4::date, NOW())
          `,
          [
            r.reserva_id,
            total,
            `AUDITORIA ALOJAMIENTO ${fechaOperativa} - Hab ${r.habitacion_numero} - Plan ${plan}`,
            fechaOperativa,
          ]
        );

        generados++;
        resumen.push({
          reserva_id: r.reserva_id,
          habitacion_numero: r.habitacion_numero,
          huesped: r.huesped,
          plan,
          fecha: fechaOperativa,
          total,
          estado: "generado",
          motivo: "",
        });
      }

      return { totalHabitaciones: ocupadas.length, generados, saltados, resumen };
    })();

    // 2) avanzar fecha operativa +1
    await client.query(`UPDATE configuracion SET fecha_sistema = fecha_sistema + INTERVAL '1 day'`);

    // leer fecha nueva
    const rNueva = await client.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
    const nuevaFecha = dayjs(rNueva.rows?.[0]?.fecha_sistema || new Date()).format("YYYY-MM-DD");

    await client.query("COMMIT");
    return res.json({
      fechaOperativa,
      nuevaFechaOperativa: nuevaFecha,
      ...resp,
      message: "Cierre del día completado (auditoría + avance de fecha).",
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("cierreDelDia error:", e);
    return res.status(500).json({ message: e.message || "Error en cierre del día." });
  } finally {
    client.release();
  }
};
