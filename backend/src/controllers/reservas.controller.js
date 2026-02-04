// src/controllers/reservas.controller.js
import { pool } from "../config/database.js";
import dayjs from "dayjs";
import { generarCargoAlojamientoReserva } from "./cargos.controller.js";

/**
 * Utilidad: verifica si el rango [desde, hasta) choca con alguna reserva
 * no cancelada de la misma habitación.
 */
const rangoChoca = async (client, habitacionId, desde, hasta) => {
  const q = `
    SELECT 1
    FROM reservas
    WHERE habitacion_id = $1
      AND estado <> 'cancelada'
      AND daterange(fecha_inicio, fecha_fin, '[)') && daterange($2, $3, '[)')
    LIMIT 1
  `;
  const { rows } = await client.query(q, [habitacionId, desde, hasta]);
  return rows.length > 0;
};

/**
 * GET /api/reservas
 * Lista general de reservas (para pantallas tipo listado).
 */
export const listarReservas = async (_req, res) => {
  try {
    const q = `
      SELECT r.*,
             h.numero AS habitacion_numero,
             h.tipo   AS habitacion_tipo,
             COALESCE(hu.nombre, '') AS huesped_nombre
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      ORDER BY r.fecha_inicio DESC, r.id DESC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error("listarReservas error:", e);
    res.status(500).json({ message: "Error al listar reservas." });
  }
};

/**
 * GET /api/reservas/:id
 */
export const obtenerReserva = async (req, res) => {
  const { id } = req.params;
  try {
    const q = `
      SELECT r.*,
             h.numero AS habitacion_numero,
             h.tipo   AS habitacion_tipo,
             COALESCE(hu.nombre, '') AS huesped_nombre,
             hu.documento,
             hu.telefono,
             hu.email
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length)
      return res.status(404).json({ message: "Reserva no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerReserva error:", e);
    res.status(500).json({ message: "Error al obtener la reserva." });
  }
};

/**
 * GET /api/reservas/calendario
 * Datos para el calendario del rack.
 */
export const getCalendarioReservas = async (_req, res) => {
  try {
    const q = `
      SELECT r.id,
             r.fecha_inicio,
             r.fecha_fin,
             r.estado,
             h.numero AS habitacion_numero,
             COALESCE(
               hu.nombre,
               r.ota_payload->>'customer_name',
               r.ota_payload->'customer'->>'name',
               r.ota_payload->'booking'->'customer'->>'name',
               r.ota_payload->'payload'->>'customer_name',
               'Cliente OTA'
             ) AS huesped_nombre
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.estado IN ('reservada','ocupada')
      ORDER BY r.fecha_inicio ASC, h.numero ASC
    `;
    const { rows } = await pool.query(q);
    res.json(rows);
  } catch (e) {
    console.error("getCalendarioReservas error:", e);
    res.status(500).json({ message: "Error al obtener reservas para el calendario." });
  }
};



// Alias por si en alguna parte del código usabas este nombre antiguo.
export const obtenerReservasCalendario = getCalendarioReservas;

/**
 * POST /api/reservas
 * Crea una reserva o un walk-in según el campo "tipo".
 *
 * Body esperado:
 * {
 *   tipo: "reserva" | "walkin",
 *   habitacion_numero: "101",
 *   fecha_inicio: "2025-11-10",
 *   fecha_fin: "2025-11-12",
 *   huesped_nombre: "Juan Perez",
 *   huesped_documento?: "123",
 *   huesped_telefono?: "555...",
 *   huesped_email?: "correo@..."
 * }
 */

export const crearReservaOWalkIn = async (req, res) => {
  const {
    tipo, // "reserva" | "walkin"
    habitacion_numero,
    fecha_inicio,
    fecha_fin,

    // ✅ Titular (ya lo envías así)
    huesped_nombre,
    huesped_documento = null,
    huesped_telefono = null,
    huesped_email = null,
    tipo_documento = null,

    nombres = null,
    primer_apellido = null,
    segundo_apellido = null,

    notas = null,
    plan = "C1",
    tarifa_snapshot = null,

    // ✅ NUEVO: acompañantes
    acompanantes = [],
  } = req.body;

  if (!["reserva", "walkin"].includes(tipo)) {
    return res.status(400).json({ message: "Tipo inválido. Use 'reserva' o 'walkin'." });
  }

  if (!habitacion_numero || !fecha_inicio || !fecha_fin) {
    return res.status(400).json({ message: "Datos incompletos." });
  }

  const desde = dayjs(fecha_inicio).format("YYYY-MM-DD");
  const hasta = dayjs(fecha_fin).format("YYYY-MM-DD");

  if (!dayjs(desde).isValid() || !dayjs(hasta).isValid() || !dayjs(hasta).isAfter(desde)) {
    return res.status(400).json({ message: "Rango de fechas inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ✅ Habitación
    const hq = await client.query(
      "SELECT id, estado, tipo FROM habitaciones WHERE numero = $1 LIMIT 1",
      [habitacion_numero]
    );
    if (!hq.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Habitación no existe." });
    }

    const habitacion = hq.rows[0];
    const habitacionId = habitacion.id;

    if (["mantenimiento", "fuera_servicio"].includes(habitacion.estado)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `No se puede ${tipo === "walkin" ? "hacer Walk-In" : "reservar"}: la habitación está en estado '${habitacion.estado}'.`,
      });
    }

    if (tipo === "walkin" && habitacion.estado === "ocupada") {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "No se puede hacer Walk-In: la habitación ya está ocupada." });
    }

    const choca = await rangoChoca(client, habitacionId, desde, hasta);
    if (choca) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "La habitación ya tiene una reserva u ocupación en ese rango." });
    }

    // ✅ Estado inicial
    let estadoReserva = "reservada";
    let checkin_at = null;

    if (tipo === "walkin") {
      const cfg = await client.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
      const fechaSistema = dayjs(cfg.rows?.[0]?.fecha_sistema || new Date()).format("YYYY-MM-DD");

      if (fechaSistema !== desde) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "El Walk-In solo se permite para el día operativo actual del sistema.",
        });
      }

      estadoReserva = "ocupada";
      checkin_at = dayjs().toDate();
    }

    // ✅ Snapshot tarifa (igual que antes)
    let snapshotFinal = tarifa_snapshot;
    if (!snapshotFinal) {
      snapshotFinal = await calcularTarifaSnapshot(client, {
        plan,
        tipoHabitacion: habitacion.tipo,
        desde,
        hasta,
      });

      if (!snapshotFinal) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `No hay tarifa configurada para plan='${plan}', tipo='${habitacion.tipo}', fecha='${desde}'.`,
        });
      }
    }

    // ============================
    // ✅ 1) Titular: buscar/crear huésped
    // ============================
    let titularId = null;

    // nombre “completo” preferido:
    const nombreTitular =
      (nombres && primer_apellido)
        ? `${nombres} ${primer_apellido} ${segundo_apellido || ""}`.trim()
        : (huesped_nombre || "").trim();

    if (tipo_documento && (huesped_documento || "").trim()) {
      const hx = await client.query(
        "SELECT id FROM huespedes WHERE upper(trim(tipo_documento)) = $1 AND trim(documento) = $2 LIMIT 1",
        [String(tipo_documento).trim().toUpperCase(), String(huesped_documento).trim()]
      );
      if (hx.rows.length) titularId = hx.rows[0].id;
    }

    if (!titularId) {
      const ins = await client.query(
        `INSERT INTO huespedes (nombre, tipo_documento, documento, telefono, email, nombres, primer_apellido, segundo_apellido, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
         RETURNING id`,
        [
          nombreTitular || "SIN NOMBRE",
          tipo_documento ? String(tipo_documento).trim().toUpperCase() : null,
          huesped_documento ? String(huesped_documento).trim() : null,
          huesped_telefono ? String(huesped_telefono).trim() : null,
          huesped_email ? String(huesped_email).trim() : null,
          nombres ? String(nombres).trim() : null,
          primer_apellido ? String(primer_apellido).trim() : null,
          segundo_apellido ? String(segundo_apellido).trim() : null,
        ]
      );
      titularId = ins.rows[0].id;
    } else {
      // ✅ si ya existe, actualiza campos básicos si llegan
      await client.query(
        `UPDATE huespedes
         SET nombre = COALESCE(NULLIF($1,''), nombre),
             telefono = COALESCE(NULLIF($2,''), telefono),
             email = COALESCE(NULLIF($3,''), email),
             nombres = COALESCE(NULLIF($4,''), nombres),
             primer_apellido = COALESCE(NULLIF($5,''), primer_apellido),
             segundo_apellido = COALESCE(NULLIF($6,''), segundo_apellido),
             updated_at = NOW()
         WHERE id = $7`,
        [
          nombreTitular || "",
          huesped_telefono ? String(huesped_telefono).trim() : "",
          huesped_email ? String(huesped_email).trim() : "",
          nombres ? String(nombres).trim() : "",
          primer_apellido ? String(primer_apellido).trim() : "",
          segundo_apellido ? String(segundo_apellido).trim() : "",
          titularId,
        ]
      );
    }

    // ============================
    // ✅ 2) Crear reserva
    // ============================
    const insR = await client.query(
      `INSERT INTO reservas
        (fecha_inicio, fecha_fin, estado, notas,
         huesped_id, habitacion_id, checkin_at, checkout_at, plan, tarifa_snapshot)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [desde, hasta, estadoReserva, notas, titularId, habitacionId, checkin_at, null, plan, snapshotFinal]
    );
    const reservaId = insR.rows[0].id;

    // ============================
    // ✅ 3) Insertar pivote: titular
    // ============================
    await client.query(
      `INSERT INTO reserva_huespedes (reserva_id, huesped_id, rol)
       VALUES ($1,$2,'titular')
       ON CONFLICT (reserva_id, huesped_id) DO UPDATE SET rol='titular'`,
      [reservaId, titularId]
    );

    // ============================
    // ✅ 4) Insertar pivote: acompañantes
    // ============================
    if (Array.isArray(acompanantes) && acompanantes.length > 0) {
      for (const a of acompanantes) {
        const td = (a?.tipo_documento || "").trim().toUpperCase();
        const doc = (a?.documento || "").trim();
        const nom = (a?.nombre || "").trim(); // si tu front manda nombre completo
        const nom2 = (a?.nombres || "").trim();
        const pa = (a?.primer_apellido || "").trim();
        const sa = (a?.segundo_apellido || "").trim();

        if (!td || !doc) continue; // mínimo para guardar

        // buscar
        let aid = null;
        const ax = await client.query(
          "SELECT id FROM huespedes WHERE upper(trim(tipo_documento))=$1 AND trim(documento)=$2 LIMIT 1",
          [td, doc]
        );
        if (ax.rows.length) {
          aid = ax.rows[0].id;
          await client.query(
            `UPDATE huespedes
             SET nombre = COALESCE(NULLIF($1,''), nombre),
                 nombres = COALESCE(NULLIF($2,''), nombres),
                 primer_apellido = COALESCE(NULLIF($3,''), primer_apellido),
                 segundo_apellido = COALESCE(NULLIF($4,''), segundo_apellido),
                 telefono = COALESCE(NULLIF($5,''), telefono),
                 email = COALESCE(NULLIF($6,''), email),
                 updated_at = NOW()
             WHERE id = $7`,
            [
              nom || `${nom2} ${pa} ${sa}`.trim(),
              nom2 || "",
              pa || "",
              sa || "",
              (a?.telefono || "").trim(),
              (a?.email || "").trim(),
              aid,
            ]
          );
        } else {
          const insA = await client.query(
            `INSERT INTO huespedes (nombre, tipo_documento, documento, telefono, email, nombres, primer_apellido, segundo_apellido, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
             RETURNING id`,
            [
              nom || `${nom2} ${pa} ${sa}`.trim() || "SIN NOMBRE",
              td,
              doc,
              (a?.telefono || "").trim() || null,
              (a?.email || "").trim() || null,
              nom2 || null,
              pa || null,
              sa || null,
            ]
          );
          aid = insA.rows[0].id;
        }

        await client.query(
          `INSERT INTO reserva_huespedes (reserva_id, huesped_id, rol)
           VALUES ($1,$2,'acompanante')
           ON CONFLICT (reserva_id, huesped_id) DO NOTHING`,
          [reservaId, aid]
        );
      }
    }

    // ✅ Estado habitación coherente
    const nuevoEstadoHabitacion = tipo === "walkin" ? "ocupada" : "reservada";
    await client.query(
      `UPDATE habitaciones SET estado = $1, updated_at = NOW() WHERE id = $2`,
      [nuevoEstadoHabitacion, habitacionId]
    );

    await client.query("COMMIT");
    return res.status(201).json({ id: reservaId, estado: estadoReserva });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("crearReservaOWalkIn error:", e);
    return res.status(500).json({ message: "Error interno al crear la reserva." });
  } finally {
    client.release();
  }
};



// Alias para código viejo que aún llame a crearReserva
export const crearReserva = crearReservaOWalkIn;

/**
 * PUT /api/reservas/:id
 * Actualiza fechas / estado / notas de una reserva.
 */
export const actualizarReserva = async (req, res) => {
  const { id } = req.params;
  const reservaId = Number(id);

  const {
    fecha_inicio,
    fecha_fin,
    estado,
    notas,
    habitacion_numero, // ✅ opcional: permitir cambiar habitación por número
  } = req.body;

  if (!reservaId || Number.isNaN(reservaId)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Traer reserva actual con lock
    const r0 = await client.query(
      `SELECT id, habitacion_id, fecha_inicio, fecha_fin, estado
       FROM reservas
       WHERE id = $1
       FOR UPDATE`,
      [reservaId]
    );
    if (!r0.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    const actual = r0.rows[0];

    // 2) Resolver nueva habitación (si mandan habitacion_numero)
    let nuevaHabitacionId = actual.habitacion_id;
    if (habitacion_numero) {
      const hq = await client.query(
        "SELECT id, estado FROM habitaciones WHERE numero = $1 LIMIT 1",
        [habitacion_numero]
      );
      if (!hq.rows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Habitación no existe." });
      }

      const hab = hq.rows[0];
      if (["mantenimiento", "fuera_servicio"].includes(hab.estado)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: `No se puede mover la reserva: la habitación destino está en estado '${hab.estado}'.`,
        });
      }

      nuevaHabitacionId = hab.id;
    }

    // 3) Resolver nuevas fechas
    const nuevoDesde = fecha_inicio
      ? dayjs(fecha_inicio).format("YYYY-MM-DD")
      : dayjs(actual.fecha_inicio).format("YYYY-MM-DD");

    const nuevoHasta = fecha_fin
      ? dayjs(fecha_fin).format("YYYY-MM-DD")
      : dayjs(actual.fecha_fin).format("YYYY-MM-DD");

    if (
      !dayjs(nuevoDesde).isValid() ||
      !dayjs(nuevoHasta).isValid() ||
      !dayjs(nuevoHasta).isAfter(nuevoDesde)
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Rango de fechas inválido." });
    }

    // 4) Si cambian fechas/habitación, validar choque excluyendo esta reserva
    const cambiaAlgo =
      nuevaHabitacionId !== actual.habitacion_id ||
      nuevoDesde !== dayjs(actual.fecha_inicio).format("YYYY-MM-DD") ||
      nuevoHasta !== dayjs(actual.fecha_fin).format("YYYY-MM-DD");

    if (cambiaAlgo) {
      const qChoca = `
        SELECT 1
        FROM reservas
        WHERE habitacion_id = $1
          AND id <> $2
          AND estado <> 'cancelada'
          AND daterange(fecha_inicio, fecha_fin, '[)') && daterange($3, $4, '[)')
        LIMIT 1
      `;
      const { rows: choque } = await client.query(qChoca, [
        nuevaHabitacionId,
        reservaId,
        nuevoDesde,
        nuevoHasta,
      ]);
      if (choque.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "La habitación ya tiene una reserva u ocupación en ese rango.",
        });
      }
    }

    // 5) Actualizar
    const upd = await client.query(
      `
      UPDATE reservas
      SET habitacion_id = $1,
          fecha_inicio  = $2,
          fecha_fin     = $3,
          estado        = COALESCE($4, estado),
          notas         = COALESCE($5, notas),
          updated_at    = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [nuevaHabitacionId, nuevoDesde, nuevoHasta, estado, notas, reservaId]
    );

    await client.query("COMMIT");
    return res.json(upd.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("actualizarReserva error:", e);
    return res.status(500).json({ message: "Error al actualizar la reserva." });
  } finally {
    client.release();
  }
};

/**
 * DELETE /api/reservas/:id
 * Lógicamente la marcamos como cancelada.
 */
export const cancelarReserva = async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT id, estado, habitacion_id FROM reservas WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rows[0];

    const upd = await client.query(
      `UPDATE reservas
       SET estado = 'cancelada',
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    // ✅ Si estaba reservada (sin ocupar), la habitación vuelve a disponible
    if (reserva.estado === "reservada") {
      await client.query(
        `UPDATE habitaciones
         SET estado = 'disponible', updated_at = NOW()
         WHERE id = $1`,
        [reserva.habitacion_id]
      );
    }

    await client.query("COMMIT");
    res.json(upd.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("cancelarReserva error:", e);
    res.status(500).json({ message: "Error al cancelar la reserva." });
  } finally {
    client.release();
  }
};

// POST /api/reservas/:id/checkin
// POST /api/reservas/:id/checkin
export const checkinReserva = async (req, res) => {
  const { id } = req.params;

  const { titular, acompanantes = [] } = req.body || {};

  const tipo_documento = (titular?.tipo_documento || "").trim().toUpperCase();
  const documento = (titular?.documento || "").trim();

  if (!tipo_documento || !documento) {
    return res.status(400).json({
      message: "No se puede hacer check-in sin tipo de documento y número de documento del titular.",
    });
  }

  const client = await pool.connect();

  // helper: arma nombre completo
  const buildNombre = (n, pa, sa) =>
    [n, pa, sa].map((x) => (x || "").trim()).filter(Boolean).join(" ").trim();

  // helper: upsert de huésped por doc
  const upsertHuesped = async ({
    tipo_documento,
    documento,
    nombres,
    primer_apellido,
    segundo_apellido,
    telefono,
    email,
  }) => {
    const td = (tipo_documento || "").trim().toUpperCase();
    const doc = (documento || "").trim();
    const nombreCompleto = buildNombre(nombres, primer_apellido, segundo_apellido);

    // si ya existe
    const q = await client.query(
      `SELECT id FROM huespedes
       WHERE upper(trim(tipo_documento)) = $1 AND trim(documento) = $2
       LIMIT 1`,
      [td, doc]
    );

    if (q.rows.length) {
      const hid = q.rows[0].id;

      await client.query(
        `UPDATE huespedes
         SET
           nombre = COALESCE(NULLIF($1,''), nombre),
           nombres = COALESCE(NULLIF($2,''), nombres),
           primer_apellido = COALESCE(NULLIF($3,''), primer_apellido),
           segundo_apellido = $4,
           telefono = COALESCE(NULLIF($5,''), telefono),
           email = COALESCE(NULLIF($6,''), email),
           updated_at = NOW()
         WHERE id = $7`,
        [
          nombreCompleto,
          (nombres || "").trim(),
          (primer_apellido || "").trim(),
          (segundo_apellido || "").trim() || null,
          (telefono || "").trim(),
          (email || "").trim(),
          hid,
        ]
      );

      return hid;
    }

    // crear
    const ins = await client.query(
      `INSERT INTO huespedes
        (nombre, tipo_documento, documento, nombres, primer_apellido, segundo_apellido, telefono, email, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
       RETURNING id`,
      [
        nombreCompleto || "SIN NOMBRE",
        td,
        doc,
        (nombres || "").trim() || null,
        (primer_apellido || "").trim() || null,
        (segundo_apellido || "").trim() || null,
        (telefono || "").trim() || null,
        (email || "").trim() || null,
      ]
    );

    return ins.rows[0].id;
  };

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, fecha_inicio, fecha_fin, estado, habitacion_id
       FROM reservas
       WHERE id = $1
       FOR UPDATE`,
      [id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rows[0];

    if (reserva.estado === "cancelada") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La reserva está cancelada." });
    }

    // validar habitación
    const hr = await client.query(
      "SELECT estado FROM habitaciones WHERE id = $1 LIMIT 1",
      [reserva.habitacion_id]
    );
    const estadoHab = hr.rows?.[0]?.estado;
    if (["mantenimiento", "fuera_servicio"].includes(estadoHab)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `No se puede hacer check-in: la habitación está en estado '${estadoHab}'.`,
      });
    }

    // validar fecha_sistema dentro del rango
    const cfg = await client.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
    const fechaSistema = cfg.rows?.[0]?.fecha_sistema
      ? dayjs(cfg.rows[0].fecha_sistema).format("YYYY-MM-DD")
      : dayjs().format("YYYY-MM-DD");

    const hoy = dayjs(fechaSistema);
    if (
      hoy.isBefore(dayjs(reserva.fecha_inicio), "day") ||
      !hoy.isBefore(dayjs(reserva.fecha_fin), "day")
    ) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "El check-in solo se puede realizar dentro del rango de la reserva.",
      });
    }

    // ✅ 1) Upsert TITULAR -> huespedIdReal
    const titularId = await upsertHuesped({
      tipo_documento,
      documento,
      nombres: titular?.nombres,
      primer_apellido: titular?.primer_apellido,
      segundo_apellido: titular?.segundo_apellido,
      telefono: titular?.telefono,
      email: titular?.email,
    });

    // ✅ 2) Reserva ocupada + huesped_id = titular
    const updReserva = await client.query(
      `UPDATE reservas
       SET estado = 'ocupada',
           checkin_at = NOW(),
           huesped_id = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [titularId, id]
    );

    // ✅ habitación ocupada
    await client.query(
      `UPDATE habitaciones
       SET estado = 'ocupada', updated_at = NOW()
       WHERE id = $1`,
      [reserva.habitacion_id]
    );

    // ✅ 3) SINCRONIZAR pivote (HU-RH6)
    // Limpia asociaciones previas (por si repiten checkin o edición)
    await client.query(`DELETE FROM reserva_huespedes WHERE reserva_id = $1`, [id]);

    // Inserta titular
    await client.query(
      `INSERT INTO reserva_huespedes (reserva_id, huesped_id, rol)
       VALUES ($1,$2,'titular')
       ON CONFLICT (reserva_id, huesped_id) DO UPDATE SET rol = EXCLUDED.rol`,
      [id, titularId]
    );

    // Inserta acompañantes
    for (const a of acompanantes || []) {
      const tdA = (a?.tipo_documento || "").trim().toUpperCase();
      const docA = (a?.documento || "").trim();

      // si vienen vacíos, los saltamos (para UX)
      if (!tdA || !docA) continue;

      const acompId = await upsertHuesped({
        tipo_documento: tdA,
        documento: docA,
        nombres: a?.nombres,
        primer_apellido: a?.primer_apellido,
        segundo_apellido: a?.segundo_apellido,
        telefono: a?.telefono,
        email: a?.email,
      });

      await client.query(
        `INSERT INTO reserva_huespedes (reserva_id, huesped_id, rol)
         VALUES ($1,$2,'acompanante')
         ON CONFLICT (reserva_id, huesped_id) DO UPDATE SET rol = 'acompanante'`,
        [id, acompId]
      );
    }

    await generarCargoAlojamientoReserva(client,id);

    await client.query("COMMIT");
    return res.json(updReserva.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("checkinReserva error:", e);
    return res.status(500).json({ message: "Error al hacer check-in." });
  } finally {
    client.release();
  }
};





/**
 * POST /api/reservas/:id/checkout
 * Ahora:
 *  - Solo permite checkout si la reserva está 'ocupada'
 *  - Debe existir ya una factura asociada
 *  - Valida fecha_sistema >= fecha_inicio + 1 día
 */
export const checkoutReserva = async (req, res) => {
  const { id } = req.params;
  const reservaId = Number(id);

  if (!reservaId || Number.isNaN(reservaId)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Traer reserva con lock (incluye habitacion_id para liberar)
    const rRes = await client.query(
      `SELECT id, estado, fecha_inicio, fecha_fin, habitacion_id
       FROM reservas
       WHERE id = $1
       FOR UPDATE`,
      [reservaId]
    );

    if (!rRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rRes.rows[0];

    // 2) Validar estado
    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Solo se puede hacer check-out de reservas en estado 'ocupada'.",
      });
    }

    // 3) Validación de fecha mínima (opcional)
    try {
      const cfg = await client.query(
        "SELECT fecha_sistema FROM configuracion LIMIT 1"
      );
      const fechaSistema = cfg.rows?.[0]?.fecha_sistema;
      if (fechaSistema) {
        const hoy = dayjs(fechaSistema).startOf("day");
        const minCheckout = dayjs(reserva.fecha_inicio)
          .add(1, "day")
          .startOf("day");
        if (hoy.isBefore(minCheckout)) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            message:
              "El check-out solo se permite a partir del día siguiente a la llegada (según la fecha operativa).",
          });
        }
      }
    } catch (_) {
      // no bloqueamos
    }

    // 4) Verificar factura emitida
    const rFact = await client.query(
      `SELECT id, estado
       FROM facturas
       WHERE reserva_id = $1
       ORDER BY id DESC
       LIMIT 1`,
      [reservaId]
    );

    if (!rFact.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "No se puede hacer check-out sin una factura generada.",
      });
    }

    const factura = rFact.rows[0];

    if (factura.estado && factura.estado !== "emitida") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "La factura debe estar en estado 'emitida' para confirmar el check-out.",
      });
    }

    // 5) Hacer checkout
    const upd = await client.query(
      `UPDATE reservas
       SET estado = 'finalizada',
           checkout_at = NOW(),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [reservaId]
    );

    // ✅ liberar habitación al finalizar
    await client.query(
      `UPDATE habitaciones
       SET estado = 'disponible', updated_at = NOW()
       WHERE id = $1`,
      [reserva.habitacion_id]
    );

    await client.query("COMMIT");
    return res.json(upd.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("checkoutReserva error:", e);
    return res.status(500).json({ message: "Error al hacer check-out." });
  } finally {
    client.release();
  }
};

/**
 * GET /api/reservas/:id/checkin/data
 */
export const obtenerDatosCheckIn = async (req, res) => {
  const { id } = req.params;
  try {
    const q = `
      SELECT
        r.id,
        r.fecha_inicio,
        r.fecha_fin,
        r.estado,
        r.plan,
        r.tarifa_snapshot,
        h.numero AS habitacion_numero,
        h.tipo AS habitacion_tipo, 

        hu.id AS huesped_id,

        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS huesped_nombre,

        hu.tipo_documento,
        hu.documento,
        hu.nombres,
        hu.primer_apellido,
        hu.segundo_apellido,
        hu.fecha_nacimiento,
        hu.fecha_expedicion,
        hu.telefono,
        hu.email,
        hu.nacionalidad,
        hu.ciudad,
        hu.direccion

      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
    `;
    const { rows } = await pool.query(q, [id]);
    if (!rows.length) return res.status(404).json({ message: "Reserva no encontrada." });
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerDatosCheckIn error:", e);
    res.status(500).json({ message: "Error al obtener datos de check-in." });
  }
};


/**
 * GET /api/reservas/:id/finanzas
 * Devuelve:
 *  - reserva (con datos básicos)
 *  - pagos
 *  - factura
 *  - detalles (líneas de factura)
 *  - resumen (totales)
 */
export const obtenerFinanzasReserva = async (req, res) => {
  const { id } = req.params;

  if (isNaN(id)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  try {
    // 1) Reserva + habitación + huésped
    const rReserva = await pool.query(
      `
      SELECT 
        r.*,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS huesped_nombre
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rReserva.rows.length) {
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rReserva.rows[0];

    // 1.1) Huéspedes asociados (PIVOTE)
    const rAsociados = await pool.query(
      `
      SELECT
        hu.id,
        rh.rol,
        hu.tipo_documento,
        hu.documento,
        hu.telefono,
        hu.email,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS nombre_completo
      FROM reserva_huespedes rh
      JOIN huespedes hu ON hu.id = rh.huesped_id
      WHERE rh.reserva_id = $1
      ORDER BY CASE WHEN rh.rol='titular' THEN 0 ELSE 1 END, nombre_completo ASC
      `,
      [id]
    );

    const huespedes_asociados = rAsociados.rows || [];

    // 2) Pagos / depósitos / cargos (todo está en tabla pagos)
    const rPagos = await pool.query(
      `
      SELECT *
      FROM pagos
      WHERE reserva_id = $1
      ORDER BY created_at ASC
      `,
      [id]
    );

    const movimientos = rPagos.rows || [];

    const total_depositos = movimientos
      .filter((p) => p.tipo === "deposito")
      .reduce((acc, p) => acc + Number(p.monto), 0);

    const total_pagos = movimientos
      .filter((p) => p.tipo === "pago")
      .reduce((acc, p) => acc + Number(p.monto), 0);

    const total_cargos = movimientos
      .filter((p) => p.tipo === "cargo")
      .reduce((acc, p) => acc + Number(p.monto), 0);

    const total_pagado = total_depositos + total_pagos;

    // 3) Factura (si existe)
    const rFactura = await pool.query(
      `
      SELECT *
      FROM facturas
      WHERE reserva_id = $1
      ORDER BY id DESC
      LIMIT 1
      `,
      [id]
    );

    const factura = rFactura.rows[0] || null;

    // 4) Detalle factura (si existe factura)
    let detalles = [];
    if (factura) {
      const rDet = await pool.query(
        `
        SELECT *
        FROM factura_detalle
        WHERE factura_id = $1
        ORDER BY id ASC
        `,
        [factura.id]
      );
      detalles = rDet.rows || [];
    }

    // ✅ total_facturado: si hay factura, manda factura.total, si no, usa total_cargos (modo Zeus)
    const total_facturado = factura ? Number(factura.total || 0) : Number(total_cargos || 0);

    const saldo = Number(total_facturado || 0) - Number(total_pagado || 0);

    return res.json({
      reserva,
      factura,
      detalles,
      movimientos, // incluye pagos/depositos/cargos
      resumen: {
        total_depositos,
        total_pagos,
        total_cargos,
        total_pagado,
        total_facturado,
        saldo,
      },
      huespedes_asociados,
    });
  } catch (e) {
    console.error("obtenerFinanzasReserva error:", e);
    return res.status(500).json({ message: "Error al obtener datos financieros." });
  }
};


/**
 * NOTA:
 * Estas funciones de facturación quedan aquí por compatibilidad,
 * pero YA NO se exponen por rutas en reservas.routes.js (las comentaste).
 * Tu facturación oficial vive en /api/facturacion (facturacion.controller.js).
 */

export const facturarReserva = async (req, res) => {
  const { id } = req.params;

  if (isNaN(id)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const rRes = await client.query(
      "SELECT * FROM reservas WHERE id = $1 FOR UPDATE",
      [id]
    );
    if (!rRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    const reserva = rRes.rows[0];

    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "Solo se puede facturar una reserva que está 'ocupada' (después del check-in y antes del check-out).",
      });
    }

    const rFacturaPrev = await client.query(
      "SELECT * FROM facturas WHERE reserva_id = $1 LIMIT 1",
      [id]
    );
    if (rFacturaPrev.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La reserva ya tiene una factura generada.",
      });
    }

    const rPagos = await client.query(
      "SELECT * FROM pagos WHERE reserva_id = $1",
      [id]
    );
    const pagos = rPagos.rows;

    const total_pagado = pagos.reduce((acc, p) => acc + Number(p.monto), 0);

    if (total_pagado <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "No hay depósitos ni pagos registrados. No se puede generar factura.",
      });
    }

    const total_factura = total_pagado;
    const numero = `F-${dayjs().format("YYYYMMDD")}-${id}`;

    const rFactura = await client.query(
      `INSERT INTO facturas (reserva_id, numero, total)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [id, numero, total_factura]
    );
    const factura = rFactura.rows[0];

    await client.query(
      `INSERT INTO factura_detalle
         (factura_id, descripcion, cantidad, valor_unitario, valor_total)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        factura.id,
        "Alojamiento y servicios de la reserva",
        1,
        total_factura,
        total_factura,
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({ factura });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("facturarReserva error:", e);
    res.status(500).json({ message: "Error al generar la factura de la reserva." });
  } finally {
    client.release();
  }
};

export const agregarCargoFactura = async (req, res) => {
  const { id } = req.params;
  const { descripcion, cantidad, valor_unitario } = req.body;

  if (!descripcion || !cantidad || !valor_unitario) {
    return res.status(400).json({
      message: "Descripción, cantidad y valor unitario son obligatorios.",
    });
  }

  const cant = Number(cantidad);
  const vu = Number(valor_unitario);

  if (isNaN(cant) || isNaN(vu) || cant <= 0 || vu < 0) {
    return res.status(400).json({
      message: "Cantidad y valor unitario deben ser numéricos válidos.",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const rRes = await client.query("SELECT * FROM reservas WHERE id = $1 FOR UPDATE", [
      id,
    ]);

    if (!rRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = rRes.rows[0];

    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:
          "Solo se pueden agregar cargos adicionales cuando la reserva está 'ocupada'.",
      });
    }

    const rFact = await client.query(
      "SELECT * FROM facturas WHERE reserva_id = $1 LIMIT 1 FOR UPDATE",
      [id]
    );

    if (!rFact.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La reserva aún no tiene factura. Genera la factura primero.",
      });
    }

    const factura = rFact.rows[0];
    const valor_total = cant * vu;

    const rDet = await client.query(
      `
      INSERT INTO factura_detalle
        (factura_id, descripcion, cantidad, valor_unitario, valor_total)
      VALUES ($1,$2,$3,$4,$5)
      RETURNING *
      `,
      [factura.id, descripcion, cant, vu, valor_total]
    );

    const detalleNuevo = rDet.rows[0];
    const nuevoTotal = Number(factura.total) + valor_total;

    const rFactUpd = await client.query(
      `
      UPDATE facturas
      SET total = $1
      WHERE id = $2
      RETURNING *
      `,
      [nuevoTotal, factura.id]
    );

    const facturaActualizada = rFactUpd.rows[0];

    await client.query("COMMIT");

    res.status(201).json({
      message: "Cargo adicional agregado correctamente.",
      detalle: detalleNuevo,
      factura: facturaActualizada,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("agregarCargoFactura error:", e);
    res.status(500).json({
      message: "Error al agregar el cargo adicional a la factura.",
    });
  } finally {
    client.release();
  }
};

export const listarHabitacionesDisponibles = async (req, res) => {
  const { desde, hasta, tipo } = req.query;

  if (!desde || !hasta) {
    return res.status(400).json({ message: "Debe enviar desde y hasta." });
  }

  const d = dayjs(desde).format("YYYY-MM-DD");
  const h = dayjs(hasta).format("YYYY-MM-DD");

  if (!dayjs(d).isValid() || !dayjs(h).isValid() || !dayjs(h).isAfter(d)) {
    return res.status(400).json({ message: "Rango de fechas inválido." });
  }

  try {
    const q = `
      SELECT h.id, h.numero, h.tipo, h.estado
      FROM habitaciones h
      WHERE ($3::text IS NULL OR lower(trim(h.tipo)) = lower(trim($3)))
        -- ✅ SOLO bloqueamos si NO es operable
        AND h.estado NOT IN ('mantenimiento', 'fuera_servicio')
        -- ✅ la disponibilidad real la decide el choque de reservas
        AND NOT EXISTS (
          SELECT 1
          FROM reservas r
          WHERE r.habitacion_id = h.id
            AND r.estado <> 'cancelada'
            AND daterange(r.fecha_inicio, r.fecha_fin, '[)') && daterange($1, $2, '[)')
        )
      ORDER BY h.numero ASC
    `;

    const { rows } = await pool.query(q, [d, h, tipo || null]);
    return res.json(rows);
  } catch (e) {
    console.error("listarHabitacionesDisponibles error:", e);
    return res.status(500).json({ message: "Error al consultar disponibilidad." });
  }
};



export const previsualizarPrecioReserva = async (req, res) => {
  const { tipo, plan, desde, hasta } = req.query;

  if (!tipo || !plan || !desde || !hasta) {
    return res.status(400).json({ message: "Parámetros incompletos." });
  }

  const d = dayjs(desde).format("YYYY-MM-DD");
  const h = dayjs(hasta).format("YYYY-MM-DD");

  if (!dayjs(d).isValid() || !dayjs(h).isValid() || !dayjs(h).isAfter(d)) {
    return res.status(400).json({ message: "Rango de fechas inválido." });
  }

  const noches = Math.max(dayjs(h).diff(dayjs(d), "day"), 1);

  const q = `
    SELECT precio
    FROM tarifas
    WHERE plan = $1
      AND lower(trim(tipo_habitacion)) = lower(trim($2))
      AND fecha_inicio <= $3
      AND fecha_fin >= $4
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `;

  const { rows } = await pool.query(q, [plan, tipo, d, h]);

  if (!rows.length) {
    return res.status(400).json({
      message: `No hay tarifa configurada para plan='${plan}', tipo='${tipo}', fecha='${d}'.`,
    });
  }

  const precioNoche = Number(rows[0].precio);
  const total = precioNoche * noches;

  return res.json({ noches, precio_noche: precioNoche, total });
};

// ✅ helper: arma snapshot desde tabla tarifas
const calcularTarifaSnapshot = async (client, { plan, tipoHabitacion, desde, hasta }) => {
  const d = dayjs(desde).format("YYYY-MM-DD");
  const h = dayjs(hasta).format("YYYY-MM-DD");
  const noches = Math.max(dayjs(h).diff(dayjs(d), "day"), 1);

  const qTarifa = `
    SELECT precio
    FROM tarifas
    WHERE plan = $1
      AND lower(trim(tipo_habitacion)) = lower(trim($2))
      AND fecha_inicio <= $3
      AND fecha_fin >= $4
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `;

  const rt = await client.query(qTarifa, [plan, tipoHabitacion, d, h]);

  if (!rt.rows.length) return null;

  const precioNoche = Number(rt.rows[0].precio);
  const total = precioNoche * noches;

  return {
    plan,
    tipo_habitacion: tipoHabitacion,
    desde: d,
    hasta: h,
    noches,
    precio_noche: precioNoche,
    total,
    moneda: "COP",
    generado_en: new Date().toISOString(),
  };
};

export const listarHuespedesDeReserva = async (req, res) => {
  const { id } = req.params;

  try {
    const q = await pool.query(
      `
      SELECT
        rh.rol,
        h.id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', h.nombres, h.primer_apellido, h.segundo_apellido)), ''),
          NULLIF(TRIM(h.nombre), ''),
          '—'
        ) AS nombre_completo,
        h.tipo_documento,
        h.documento,
        h.telefono,
        h.email
      FROM reserva_huespedes rh
      JOIN huespedes h ON h.id = rh.huesped_id
      WHERE rh.reserva_id = $1
      ORDER BY CASE WHEN rh.rol='titular' THEN 0 ELSE 1 END, h.id ASC
      `,
      [id]
    );

    return res.json(q.rows);
  } catch (e) {
    console.error("listarHuespedesDeReserva error:", e);
    return res.status(500).json({ message: "Error al listar huéspedes asociados." });
  }
};

// ✅ GET: listar huéspedes asociados (titular + acompañantes)
export const obtenerHuespedesAsociadosReserva = async (req, res) => {
  const { id } = req.params;
  if (isNaN(id)) return res.status(400).json({ message: "ID inválido." });

  try {
    const r = await pool.query(
      `
      SELECT
        hu.id,
        rh.rol,
        hu.tipo_documento,
        hu.documento,
        hu.telefono,
        hu.email,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS nombre_completo
      FROM reserva_huespedes rh
      JOIN huespedes hu ON hu.id = rh.huesped_id
      WHERE rh.reserva_id = $1
      ORDER BY CASE WHEN rh.rol='titular' THEN 0 ELSE 1 END, nombre_completo ASC
      `,
      [id]
    );

    return res.json(r.rows || []);
  } catch (e) {
    console.error("obtenerHuespedesAsociadosReserva error:", e);
    return res.status(500).json({ message: "Error al obtener huéspedes asociados." });
  }
};

// ✅ PUT: sincronizar acompañantes (NO cambia titular ni reserva.huesped_id)
export const actualizarAcompanantesReserva = async (req, res) => {
  const { id } = req.params;
  const { acompanantes = [] } = req.body || {};

  if (isNaN(id)) return res.status(400).json({ message: "ID inválido." });
  if (!Array.isArray(acompanantes)) {
    return res.status(400).json({ message: "acompanantes debe ser un arreglo." });
  }

  const client = await pool.connect();

  const buildNombre = (n, pa, sa) =>
    [n, pa, sa].map((x) => (x || "").trim()).filter(Boolean).join(" ").trim();

  const upsertHuesped = async ({
    tipo_documento,
    documento,
    nombres,
    primer_apellido,
    segundo_apellido,
    telefono,
    email,
  }) => {
    const td = (tipo_documento || "").trim().toUpperCase();
    const doc = (documento || "").trim();
    const nombreCompleto = buildNombre(nombres, primer_apellido, segundo_apellido);

    const q = await client.query(
      `SELECT id FROM huespedes
       WHERE upper(trim(tipo_documento)) = $1 AND trim(documento) = $2
       LIMIT 1`,
      [td, doc]
    );

    if (q.rows.length) {
      const hid = q.rows[0].id;
      await client.query(
        `UPDATE huespedes
         SET
           nombre = COALESCE(NULLIF($1,''), nombre),
           nombres = COALESCE(NULLIF($2,''), nombres),
           primer_apellido = COALESCE(NULLIF($3,''), primer_apellido),
           segundo_apellido = $4,
           telefono = COALESCE(NULLIF($5,''), telefono),
           email = COALESCE(NULLIF($6,''), email),
           updated_at = NOW()
         WHERE id = $7`,
        [
          nombreCompleto,
          (nombres || "").trim(),
          (primer_apellido || "").trim(),
          (segundo_apellido || "").trim() || null,
          (telefono || "").trim(),
          (email || "").trim(),
          hid,
        ]
      );
      return hid;
    }

    const ins = await client.query(
      `INSERT INTO huespedes
        (nombre, tipo_documento, documento, nombres, primer_apellido, segundo_apellido, telefono, email, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW())
       RETURNING id`,
      [
        nombreCompleto || "SIN NOMBRE",
        td,
        doc,
        (nombres || "").trim() || null,
        (primer_apellido || "").trim() || null,
        (segundo_apellido || "").trim() || null,
        (telefono || "").trim() || null,
        (email || "").trim() || null,
      ]
    );

    return ins.rows[0].id;
  };

  try {
    await client.query("BEGIN");

    // 1) asegurar que la reserva existe y obtener titular actual
    const rr = await client.query(
      `SELECT id, huesped_id FROM reservas WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!rr.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const titularId = rr.rows[0].huesped_id;
    if (!titularId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La reserva no tiene titular (huesped_id)." });
    }

    // 2) garantizar pivote titular
    await client.query(
      `INSERT INTO reserva_huespedes (reserva_id, huesped_id, rol)
       VALUES ($1,$2,'titular')
       ON CONFLICT (reserva_id, huesped_id) DO UPDATE SET rol='titular'`,
      [id, titularId]
    );

    // 3) borrar solo acompañantes previos
    await client.query(
      `DELETE FROM reserva_huespedes WHERE reserva_id = $1 AND rol = 'acompanante'`,
      [id]
    );

    // 4) insertar acompañantes nuevos (mínimo tipo_documento + documento)
    for (const a of acompanantes) {
      const td = (a?.tipo_documento || "").trim().toUpperCase();
      const doc = (a?.documento || "").trim();

      if (!td || !doc) continue;

      const acompId = await upsertHuesped({
        tipo_documento: td,
        documento: doc,
        nombres: a?.nombres,
        primer_apellido: a?.primer_apellido,
        segundo_apellido: a?.segundo_apellido,
        telefono: a?.telefono,
        email: a?.email,
      });

      // evitar que metan al titular como acompañante
      if (acompId === titularId) continue;

      await client.query(
        `INSERT INTO reserva_huespedes (reserva_id, huesped_id, rol)
         VALUES ($1,$2,'acompanante')
         ON CONFLICT (reserva_id, huesped_id) DO UPDATE SET rol='acompanante'`,
        [id, acompId]
      );
    }

    // 5) devolver lista actualizada
    const out = await client.query(
      `
      SELECT
        hu.id,
        rh.rol,
        hu.tipo_documento,
        hu.documento,
        hu.telefono,
        hu.email,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS nombre_completo
      FROM reserva_huespedes rh
      JOIN huespedes hu ON hu.id = rh.huesped_id
      WHERE rh.reserva_id = $1
      ORDER BY CASE WHEN rh.rol='titular' THEN 0 ELSE 1 END, nombre_completo ASC
      `,
      [id]
    );

    await client.query("COMMIT");
    return res.json(out.rows || []);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("actualizarAcompanantesReserva error:", e);
    return res.status(500).json({ message: "Error al actualizar acompañantes." });
  } finally {
    client.release();
  }
};





