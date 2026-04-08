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
/**
 * GET /api/reservas
 * HU-R7: Filtrar reservas por fecha, huésped o estado
 *
 * Query params opcionales:
 *   ?q=texto        → busca en nombre huésped, número habitación, id
 *   ?estado=        → reservada | ocupada | finalizada | cancelada
 *   ?desde=         → YYYY-MM-DD  (fecha_inicio >= desde)
 *   ?hasta=         → YYYY-MM-DD  (fecha_inicio <= hasta)
 *
 * INSTRUCCIÓN: Reemplaza la función listarReservas existente
 * en src/controllers/reservas.controller.js por esta versión.
 */
export const listarReservas = async (req, res) => {
  try {
    const { q = "", estado = "", desde = "", hasta = "" } = req.query;

    const filtros = [];
    const params = [];

    // Filtro por texto: huésped, habitación o ID
    if (q.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`);
      const i = params.length;
      filtros.push(`
        (
          LOWER(COALESCE(hu.nombre, '')) LIKE $${i}
          OR LOWER(COALESCE(
            NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
            ''
          )) LIKE $${i}
          OR LOWER(COALESCE(hu.documento, '')) LIKE $${i}
          OR CAST(h.numero AS TEXT) ILIKE $${i}
          OR CAST(r.id AS TEXT) LIKE $${i}
        )
      `);
    }

    // Filtro por origen (ota | manual)
    if (req.query.origen) {
      params.push(req.query.origen.trim());
      filtros.push(`r.origen = $${params.length}`);
    }

    // Filtro por estado
    if (estado && estado !== "todas") {
      params.push(estado.trim());
      filtros.push(`r.estado = $${params.length}`);
    }

    // Filtro por fecha de inicio (desde)
    if (desde.trim()) {
      params.push(desde.trim());
      filtros.push(`r.fecha_inicio >= $${params.length}::date`);
    }

    // Filtro por fecha de inicio (hasta)
    if (hasta.trim()) {
      params.push(hasta.trim());
      filtros.push(`r.fecha_inicio <= $${params.length}::date`);
    }

    // Filtro por origen (manual | ota)
    const { origen = "", fuente = "" } = req.query;
    if (origen.trim()) {
      params.push(origen.trim());
      filtros.push(`r.origen = $${params.length}`);
    }
    if (fuente.trim()) {
      params.push(fuente.trim());
      filtros.push(`r.fuente = $${params.length}`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const sql = `
      SELECT
        r.id,
        r.fecha_inicio,
        r.fecha_fin,
        r.estado,
        r.notas,
        r.plan,
        r.facturada,
        r.checkin_at,
        r.checkout_at,
        r.created_at,
        r.origen,
        r.fuente,
        r.ota_canal,
        r.ota_reserva_id,
        r.ota_payload,
        h.numero  AS habitacion_numero,
        h.tipo    AS habitacion_tipo,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          ''
        ) AS huesped_nombre,
        hu.documento,
        hu.telefono,
        hu.email,
        r.origen,
        r.fuente,
        r.ota_canal,
        r.ota_reserva_id,
        r.ota_payload
      FROM reservas r
      JOIN habitaciones h  ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      ${where}
      ORDER BY r.fecha_inicio DESC, r.id DESC
      LIMIT 500
    `;

    const { rows } = await pool.query(sql, params);
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
    fuente = "recepcion",
    usuario = "recepcion",

    // acompañantes
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
         huesped_id, habitacion_id, checkin_at, checkout_at, plan, tarifa_snapshot, fuente)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [desde, hasta, estadoReserva, notas, titularId, habitacionId, checkin_at, null, plan, snapshotFinal, fuente || "recepcion"]
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

    // HU-R11: historial creación
    await client.query(
      `INSERT INTO reservas_historial (reserva_id, usuario, accion, notas)
       VALUES ($1, $2, 'created', $3)`,
      [reservaId, usuario, `Reserva creada. Fuente: ${fuente || "recepcion"}`]
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
    habitacion_numero,
    fuente,
    plan,
    usuario = "recepcion",
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
          plan          = COALESCE($7, plan),
          updated_at    = NOW()
      WHERE id = $6
      RETURNING *
      `,
      [nuevaHabitacionId, nuevoDesde, nuevoHasta, estado, notas, reservaId, plan ?? null]
    );

    // HU-R15: guardar fuente si viene
    if (fuente) {
      await client.query(
        `UPDATE reservas SET fuente = $1 WHERE id = $2`,
        [fuente, reservaId]
      );
    }

    // HU-R11: historial de cambios
    const cambiosList = [];
    if (nuevoDesde !== dayjs(actual.fecha_inicio).format("YYYY-MM-DD"))
      cambiosList.push(`fecha_inicio: ${dayjs(actual.fecha_inicio).format("YYYY-MM-DD")} → ${nuevoDesde}`);
    if (nuevoHasta !== dayjs(actual.fecha_fin).format("YYYY-MM-DD"))
      cambiosList.push(`fecha_fin: ${dayjs(actual.fecha_fin).format("YYYY-MM-DD")} → ${nuevoHasta}`);
    if (nuevaHabitacionId !== actual.habitacion_id)
      cambiosList.push("habitación cambiada");
    if (notas !== undefined) cambiosList.push("notas actualizadas");
    if (cambiosList.length) {
      await client.query(
        `INSERT INTO reservas_historial (reserva_id, usuario, accion, notas)
         VALUES ($1, $2, 'updated', $3)`,
        [reservaId, usuario, cambiosList.join(" | ")]
      );
    }

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

    await client.query(
      `INSERT INTO reservas_historial (reserva_id, usuario, accion, notas)
       VALUES ($1, 'sistema', 'cancelada', 'Reserva cancelada.')`,
      [id]
    );

    await client.query("COMMIT");
    try { const fn = req?.app?.get("emitNotificacion"); if(fn) fn("warning","Reserva cancelada",`Reserva #${id} cancelada.`,{reserva_id:id}); } catch(_){}
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
    try { const fn = req?.app?.get("emitNotificacion"); if(fn) fn("success","Check-in registrado",`Check-in realizado para reserva #${id}.`,{reserva_id:id}); } catch(_){}
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
    try { const fn = req?.app?.get("emitNotificacion"); if(fn) fn("info","Check-out registrado",`Check-out realizado para reserva #${reservaId}.`,{reserva_id:reservaId}); } catch(_){}
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
    // ✅ FIX: busca el titular en reserva_huespedes (sistema nuevo) Y en
    //         reservas.huesped_id (sistema legado). Usa COALESCE para tomar
    //         el que exista.
    const q = `
      SELECT
        r.id,
        r.fecha_inicio,
        r.fecha_fin,
        r.estado,
        r.plan,
        r.tarifa_snapshot,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,

        -- titular: primero busca en reserva_huespedes, luego en reservas.huesped_id
        COALESCE(hu_rh.id, hu_leg.id)                       AS huesped_id,

        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ',
            COALESCE(hu_rh.nombres,  hu_leg.nombres),
            COALESCE(hu_rh.primer_apellido,  hu_leg.primer_apellido),
            COALESCE(hu_rh.segundo_apellido, hu_leg.segundo_apellido)
          )), ''),
          NULLIF(TRIM(COALESCE(hu_rh.nombre, hu_leg.nombre)), ''),
          ''
        ) AS huesped_nombre,

        COALESCE(hu_rh.tipo_documento,   hu_leg.tipo_documento)   AS tipo_documento,
        COALESCE(hu_rh.documento,        hu_leg.documento)        AS documento,
        COALESCE(hu_rh.nombres,          hu_leg.nombres)          AS nombres,
        COALESCE(hu_rh.primer_apellido,  hu_leg.primer_apellido)  AS primer_apellido,
        COALESCE(hu_rh.segundo_apellido, hu_leg.segundo_apellido) AS segundo_apellido,
        COALESCE(hu_rh.fecha_nacimiento, hu_leg.fecha_nacimiento) AS fecha_nacimiento,
        COALESCE(hu_rh.fecha_expedicion, hu_leg.fecha_expedicion) AS fecha_expedicion,
        COALESCE(hu_rh.telefono,         hu_leg.telefono)         AS telefono,
        COALESCE(hu_rh.email,            hu_leg.email)            AS email,
        COALESCE(hu_rh.nacionalidad,     hu_leg.nacionalidad)     AS nacionalidad,
        COALESCE(hu_rh.ciudad,           hu_leg.ciudad)           AS ciudad,
        COALESCE(hu_rh.direccion,        hu_leg.direccion)        AS direccion

      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id

      -- titular por reserva_huespedes (sistema nuevo)
      LEFT JOIN reserva_huespedes rh
             ON rh.reserva_id = r.id AND rh.rol = 'titular'
      LEFT JOIN huespedes hu_rh ON hu_rh.id = rh.huesped_id

      -- titular por campo legado reservas.huesped_id
      LEFT JOIN huespedes hu_leg ON hu_leg.id = r.huesped_id

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

    const total_descuentos = movimientos
      .filter((p) => p.tipo === "descuento")
      .reduce((acc, p) => acc + Number(p.monto), 0);

    const total_pagado = total_depositos + total_pagos + total_descuentos;

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
        total_descuentos,
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

  // Resolver el tipo: acepta tanto el nombre ("Doble") como el código ("DBL")
  const tipoRows = await pool.query(
    `SELECT nombre, codigo FROM tipos_habitacion
     WHERE lower(trim(nombre)) = lower(trim($1)) OR lower(trim(codigo)) = lower(trim($1))
     LIMIT 1`,
    [tipo]
  );
  const tipoNombre = tipoRows.rows[0]?.nombre || tipo;
  const tipoCodigo = tipoRows.rows[0]?.codigo || tipo;

  const q = `
    SELECT precio
    FROM tarifas
    WHERE plan = $1
      AND (
        lower(trim(tipo_habitacion)) = lower(trim($2))
        OR lower(trim(tipo_habitacion)) = lower(trim($3))
      )
      AND fecha_inicio <= $4
      AND fecha_fin >= $5
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `;

  const { rows } = await pool.query(q, [plan, tipoNombre, tipoCodigo, d, h]);

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

  // Resolver tipo por nombre o código
  const tipoRes = await client.query(
    `SELECT nombre, codigo FROM tipos_habitacion
     WHERE lower(trim(nombre)) = lower(trim($1)) OR lower(trim(codigo)) = lower(trim($1)) LIMIT 1`,
    [tipoHabitacion]
  );
  const tNombre = tipoRes.rows[0]?.nombre || tipoHabitacion;
  const tCodigo = tipoRes.rows[0]?.codigo || tipoHabitacion;

  const qTarifa = `
    SELECT precio
    FROM tarifas
    WHERE plan = $1
      AND (
        lower(trim(tipo_habitacion)) = lower(trim($2))
        OR lower(trim(tipo_habitacion)) = lower(trim($3))
      )
      AND fecha_inicio <= $4
      AND fecha_fin >= $5
    ORDER BY fecha_inicio DESC
    LIMIT 1
  `;

  const rt = await client.query(qTarifa, [plan, tNombre, tCodigo, d, h]);

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

// ============================================================
// HU-R13: Lista de llegadas del día
// GET /api/reservas/llegadas?fecha=YYYY-MM-DD
// ============================================================
export const listarLlegadasDelDia = async (req, res) => {
  try {
    const cfg = await pool.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
    const fechaSistema = cfg.rows?.[0]?.fecha_sistema
      ? dayjs(cfg.rows[0].fecha_sistema).format("YYYY-MM-DD")
      : dayjs().format("YYYY-MM-DD");

    const fecha = req.query.fecha || fechaSistema;

    const { rows } = await pool.query(`
      SELECT
        r.id,
        r.fecha_inicio,
        r.fecha_fin,
        r.estado,
        r.notas,
        r.no_show,
        r.fuente,
        h.numero  AS habitacion_numero,
        h.tipo    AS habitacion_tipo,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)), ''),
          NULLIF(TRIM(hu.nombre), ''),
          '—'
        ) AS huesped_nombre,
        hu.documento,
        hu.telefono,
        CASE
          WHEN r.no_show = TRUE      THEN 'no_show'
          WHEN r.estado  = 'ocupada' THEN 'checked_in'
          ELSE                            'pendiente'
        END AS semaforo
      FROM reservas r
      JOIN habitaciones h    ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE r.fecha_inicio = $1::date
        AND r.estado NOT IN ('cancelada', 'finalizada')
      ORDER BY h.numero ASC
    `, [fecha]);

    res.json({ fecha, total: rows.length, items: rows });
  } catch (e) {
    console.error("listarLlegadasDelDia error:", e);
    res.status(500).json({ message: "Error al listar llegadas del día." });
  }
};

// ============================================================
// HU-R14: Marcar no-show
// POST /api/reservas/:id/no-show
// ============================================================
export const marcarNoShow = async (req, res) => {
  const { id } = req.params;
  const { usuario = "recepcion" } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, estado FROM reservas WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    if (rows[0].estado !== "reservada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Solo se puede marcar no-show en estado 'reservada'. Estado actual: '${rows[0].estado}'.`,
      });
    }

    await client.query(
      `UPDATE reservas SET no_show = TRUE, estado = 'cancelada', updated_at = NOW() WHERE id = $1`,
      [id]
    );

    await client.query(
      `INSERT INTO reservas_historial (reserva_id, usuario, accion, notas)
       VALUES ($1, $2, 'no_show', 'Huésped no se presentó.')`,
      [id, usuario]
    );

    await client.query("COMMIT");
    res.json({ message: "Reserva marcada como no-show." });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("marcarNoShow error:", e);
    res.status(500).json({ message: "Error al marcar no-show." });
  } finally {
    client.release();
  }
};

// ============================================================
// HU-R8: Extender estadía
// POST /api/reservas/:id/extender
// Body: { nueva_fecha_fin: "YYYY-MM-DD", usuario? }
// ============================================================
export const extenderEstadia = async (req, res) => {
  const { id } = req.params;
  const { nueva_fecha_fin, usuario = "recepcion" } = req.body;

  if (!nueva_fecha_fin)
    return res.status(400).json({ message: "Debe enviar nueva_fecha_fin." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT id, estado, habitacion_id, fecha_inicio, fecha_fin FROM reservas WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }
    const r = rows[0];

    if (r.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Solo se puede extender una reserva ocupada." });
    }

    const fechaFinActual = dayjs(r.fecha_fin).format("YYYY-MM-DD");
    const fechaFinNueva  = dayjs(nueva_fecha_fin).format("YYYY-MM-DD");

    // Validar mínimo: nueva fecha debe ser al menos 1 día después del check-in
    if (!dayjs(fechaFinNueva).isAfter(dayjs(r.fecha_inicio))) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La fecha de salida debe ser al menos un día después del check-in.",
      });
    }

    // Solo verificar choques si se extiende; si se reduce no hay conflicto
    const seExtiende = dayjs(fechaFinNueva).isAfter(dayjs(fechaFinActual));
    if (seExtiende) {
      const { rows: choque } = await client.query(
        `SELECT 1 FROM reservas
         WHERE habitacion_id = $1
           AND id <> $2
           AND estado <> 'cancelada'
           AND daterange(fecha_inicio, fecha_fin, '[)') && daterange($3, $4, '[)')
         LIMIT 1`,
        [r.habitacion_id, id, fechaFinActual, fechaFinNueva]
      );
      if (choque.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          message: "La habitación ya tiene otra reserva en ese rango.",
        });
      }
    }

    await client.query(
      `UPDATE reservas SET fecha_fin = $1, updated_at = NOW() WHERE id = $2`,
      [fechaFinNueva, id]
    );

    // Generar cargo adicional de alojamiento
    await generarCargoAlojamientoReserva(client, Number(id));

    await client.query(
      `INSERT INTO reservas_historial
         (reserva_id, usuario, accion, campo, valor_anterior, valor_nuevo, notas)
       VALUES ($1, $2, 'modificada', 'fecha_fin', $3, $4, $5)`,
      [id, usuario, fechaFinActual, fechaFinNueva, seExtiende ? 'Extensión de estadía' : 'Reducción de estadía']
    );

    await client.query("COMMIT");
    res.json({ message: seExtiende ? "Estadía extendida." : "Estadía reducida.", fecha_fin: fechaFinNueva });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("extenderEstadia error:", e);
    res.status(500).json({ message: "Error al extender la estadía." });
  } finally {
    client.release();
  }
};

// ============================================================
// HU-R11: Historial de cambios
// GET /api/reservas/:id/historial
// ============================================================
export const obtenerHistorialReserva = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, accion, campo, valor_anterior, valor_nuevo, usuario, notas, created_at
       FROM reservas_historial
       WHERE reserva_id = $1
       ORDER BY created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error("obtenerHistorialReserva error:", e);
    res.status(500).json({ message: "Error al obtener historial." });
  }
};


// ============================================================
// GET /api/reservas/:id/registro-hotelero
// Genera y descarga el PDF del registro hotelero (pdfkit)
// ============================================================
export const generarRegistroHotelero = async (req, res) => {
  const { id } = req.params;
  try {
    // 1) Datos de la reserva + habitación
    const { rows: rRows } = await pool.query(`
      SELECT
        r.id, r.fecha_inicio, r.fecha_fin, r.estado,
        r.plan, r.notas, r.fuente, r.huesped_id,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        (r.fecha_fin::date - r.fecha_inicio::date) AS noches
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE r.id = $1 LIMIT 1
    `, [id]);
    if (!rRows.length)
      return res.status(404).json({ message: "Reserva no encontrada." });
    const reserva = rRows[0];

    // 2) Datos del titular
    let titular = {};
    if (reserva.huesped_id) {
      const { rows: hRows } = await pool.query(`
        SELECT id, nombre, nombres, primer_apellido, segundo_apellido,
               tipo_documento, documento, telefono, email,
               fecha_nacimiento, nacionalidad, ciudad, direccion
        FROM huespedes WHERE id = $1 LIMIT 1
      `, [reserva.huesped_id]);
      if (hRows.length) titular = hRows[0];
    }

    // 3) Acompañantes
    const { rows: acomp } = await pool.query(`
      SELECT h.nombres, h.primer_apellido, h.segundo_apellido,
             h.tipo_documento, h.documento, h.telefono, h.email
      FROM reserva_huespedes rh
      JOIN huespedes h ON h.id = rh.huesped_id
      WHERE rh.reserva_id = $1 AND rh.rol = 'acompanante'
      ORDER BY h.primer_apellido
    `, [id]);

    // 4) Config del hotel
    let hotel_nombre = "Hotel PMS", hotel_direccion = "";
    try {
      const cfg = await pool.query(`SELECT nombre, direccion FROM configuracion LIMIT 1`);
      if (cfg.rows.length) {
        hotel_nombre    = cfg.rows[0].nombre    || hotel_nombre;
        hotel_direccion = cfg.rows[0].direccion || hotel_direccion;
      }
    } catch { /* tabla configuracion puede no existir */ }

    // 5) Generar PDF con pdfkit (JS puro)
    const { generarRegistroHotelero: generarPDF } = await import("../utils/registroHotelero.js");

    const datos = {
      hotel_nombre,
      hotel_direccion,
      reserva_id:        reserva.id,
      habitacion_numero: reserva.habitacion_numero,
      habitacion_tipo:   reserva.habitacion_tipo,
      plan:              reserva.plan,
      estado:            reserva.estado,
      fecha_inicio:      dayjs(reserva.fecha_inicio).format("DD/MM/YYYY"),
      fecha_fin:         dayjs(reserva.fecha_fin).format("DD/MM/YYYY"),
      noches:            reserva.noches,
      fuente:            reserva.fuente,
      notas:             reserva.notas || "",
      titular,
      acompanantes:      acomp,
    };

    const pdfBuffer = await generarPDF(datos);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="registro_hotelero_reserva_${id}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (e) {
    console.error("generarRegistroHotelero error:", e);
    res.status(500).json({ message: "Error al generar el registro hotelero." });
  }
};
// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reservas/:id/promociones-aplicables
// Retorna promociones activas que aplican a este plan/tipo/noches/fechas
// ─────────────────────────────────────────────────────────────────────────────
export const promocionesAplicables = async (req, res) => {
  const { id } = req.params;
  try {
    // 1) Obtener datos de la reserva
    const rRes = await pool.query(
      `SELECT r.id, r.plan, r.fecha_inicio, r.fecha_fin, r.estado,
              h.tipo AS tipo_habitacion,
              GREATEST(1, DATE_PART('day', r.fecha_fin::timestamp - r.fecha_inicio::timestamp)::int) AS noches
       FROM reservas r
       JOIN habitaciones h ON h.id = r.habitacion_id
       WHERE r.id = $1 LIMIT 1`,
      [id]
    );
    if (!rRes.rows.length) return res.status(404).json({ message: "Reserva no encontrada." });
    const reserva = rRes.rows[0];

    if (reserva.estado !== "ocupada") {
      return res.status(400).json({ message: "Solo se pueden aplicar promociones a reservas en check-in (ocupada)." });
    }

    // 2) Obtener total alojamiento para calcular descuentos porcentuales
    const snapR = await pool.query(
      `SELECT tarifa_snapshot FROM reservas WHERE id = $1`, [id]
    );
    let totalAlojamiento = 0;
    const snap = snapR.rows[0]?.tarifa_snapshot;
    if (snap) {
      if (typeof snap === "object" && snap.total) {
        totalAlojamiento = Number(snap.total);
      } else if (!isNaN(Number(snap))) {
        totalAlojamiento = Number(snap);
      }
    }
    // Si no hay snapshot, intentar con tarifas
    if (!totalAlojamiento) {
      try {
        const client = await pool.connect();
        const calc = await calcularTarifaSnapshot(client, {
          plan: reserva.plan, tipoHabitacion: reserva.tipo_habitacion,
          desde: reserva.fecha_inicio, hasta: reserva.fecha_fin
        });
        client.release();
        totalAlojamiento = calc?.total || 0;
      } catch { totalAlojamiento = 0; }
    }

    const hoy = dayjs().format("YYYY-MM-DD");

    // 3) Consultar promociones aplicables
    const pRows = await pool.query(
      `SELECT * FROM promociones
       WHERE activa = true
         AND (plan IS NULL OR plan = $1)
         AND (tipo_habitacion IS NULL OR lower(trim(tipo_habitacion)) = lower(trim($2)))
         AND (min_noches IS NULL OR min_noches <= $3)
         AND (fecha_inicio IS NULL OR fecha_inicio <= $4::date)
         AND (fecha_fin IS NULL OR fecha_fin >= $4::date)
       ORDER BY tipo, valor DESC`,
      [reserva.plan, reserva.tipo_habitacion, reserva.noches, hoy]
    );

    // 4) Calcular monto descuento para cada promoción
    const precioNoche = reserva.noches > 0 ? totalAlojamiento / reserva.noches : 0;

    const promociones = pRows.rows.map(p => {
      let descuento = 0;
      if (p.tipo === "porcentaje") {
        descuento = Math.round((Number(p.valor) / 100) * totalAlojamiento);
      } else if (p.tipo === "monto_fijo") {
        descuento = Math.min(Number(p.valor), totalAlojamiento);
      } else if (p.tipo === "noches_gratis") {
        descuento = Math.round(Number(p.valor) * precioNoche);
      }
      return { ...p, total_alojamiento: totalAlojamiento, descuento_calculado: descuento };
    });

    res.json({ reserva, promociones });
  } catch (e) {
    console.error("promocionesAplicables error:", e);
    res.status(500).json({ message: "Error al obtener promociones aplicables." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/reservas/:id/aplicar-promocion  { promocion_id }
// Registra el descuento como movimiento tipo='descuento' en pagos
// ─────────────────────────────────────────────────────────────────────────────
export const aplicarPromocion = async (req, res) => {
  const { id } = req.params;
  const { promocion_id } = req.body || {};

  if (!promocion_id) return res.status(400).json({ message: "promocion_id es requerido." });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar reserva ocupada
    const rRes = await client.query(
      `SELECT r.id, r.plan, r.fecha_inicio, r.fecha_fin, r.estado, r.tarifa_snapshot,
              h.tipo AS tipo_habitacion,
              GREATEST(1, DATE_PART('day', r.fecha_fin::timestamp - r.fecha_inicio::timestamp)::int) AS noches
       FROM reservas r
       JOIN habitaciones h ON h.id = r.habitacion_id
       WHERE r.id = $1 LIMIT 1`, [id]
    );
    if (!rRes.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Reserva no encontrada." }); }
    const reserva = rRes.rows[0];
    if (reserva.estado !== "ocupada") { await client.query("ROLLBACK"); return res.status(400).json({ message: "Solo se puede aplicar a reservas ocupadas (en check-in)." }); }

    // Verificar que la promoción no se haya aplicado ya
    const yaAplicada = await client.query(
      `SELECT id FROM pagos WHERE reserva_id = $1 AND tipo = 'descuento' AND referencia LIKE $2`,
      [id, `%[PROMO-${promocion_id}]%`]
    );
    if (yaAplicada.rows.length) { await client.query("ROLLBACK"); return res.status(400).json({ message: "Esta promoción ya fue aplicada a esta reserva." }); }

    // Obtener promoción
    const pRow = await client.query(`SELECT * FROM promociones WHERE id = $1 AND activa = true LIMIT 1`, [promocion_id]);
    if (!pRow.rows.length) { await client.query("ROLLBACK"); return res.status(404).json({ message: "Promoción no encontrada o inactiva." }); }
    const promo = pRow.rows[0];

    // Calcular total alojamiento
    let totalAlojamiento = 0;
    const snap = reserva.tarifa_snapshot;
    if (snap && typeof snap === "object" && snap.total) totalAlojamiento = Number(snap.total);
    else if (snap && !isNaN(Number(snap))) totalAlojamiento = Number(snap);
    if (!totalAlojamiento) {
      const calc = await calcularTarifaSnapshot(client, {
        plan: reserva.plan, tipoHabitacion: reserva.tipo_habitacion,
        desde: reserva.fecha_inicio, hasta: reserva.fecha_fin
      });
      totalAlojamiento = calc?.total || 0;
    }

    const precioNoche = reserva.noches > 0 ? totalAlojamiento / reserva.noches : 0;
    let descuento = 0;
    if (promo.tipo === "porcentaje") descuento = Math.round((Number(promo.valor) / 100) * totalAlojamiento);
    else if (promo.tipo === "monto_fijo") descuento = Math.min(Number(promo.valor), totalAlojamiento);
    else if (promo.tipo === "noches_gratis") descuento = Math.round(Number(promo.valor) * precioNoche);

    if (descuento <= 0) { await client.query("ROLLBACK"); return res.status(400).json({ message: "El descuento calculado es 0. Verifica la tarifa de alojamiento." }); }

    // Insertar descuento como movimiento
    const ins = await client.query(
      `INSERT INTO pagos (reserva_id, tipo, metodo, monto, referencia, fecha, created_at)
       VALUES ($1, 'descuento', 'otro', $2, $3, NOW()::date, NOW())
       RETURNING *`,
      [id, descuento, `DESCUENTO: ${promo.nombre} [PROMO-${promo.id}]`]
    );

    await client.query("COMMIT");
    return res.status(201).json({
      movimiento: ins.rows[0],
      promocion: promo,
      descuento_aplicado: descuento,
    });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("aplicarPromocion error:", e);
    return res.status(500).json({ message: e.message || "Error al aplicar la promoción." });
  } finally {
    client.release();
  }
};
