// src/controllers/huespedes.controller.js
import { pool } from "../config/database.js";

const buildNombreCompleto = (nombres, primer_apellido, segundo_apellido) => {
  const parts = [nombres, primer_apellido, segundo_apellido]
    .map((x) => (x || "").trim())
    .filter(Boolean);
  return parts.join(" ").trim();
};

//
// GET /api/huespedes
// Opcional: ?q=texto&desde=YYYY-MM-DD&hasta=YYYY-MM-DD
//
export const listarHuespedes = async (req, res) => {
  const { q, desde, hasta } = req.query;

  const filtros = [];
  const params = [];

  // 🔎 Filtro texto (nombre completo, documento, email, teléfono)
  if (q && q.trim() !== "") {
    params.push(`%${q.trim().toLowerCase()}%`);
    const i = params.length;

    filtros.push(`
      (
        LOWER(COALESCE(h.nombre,'')) LIKE $${i}
        OR LOWER(COALESCE(h.nombres,'')) LIKE $${i}
        OR LOWER(COALESCE(h.primer_apellido,'')) LIKE $${i}
        OR LOWER(COALESCE(h.segundo_apellido,'')) LIKE $${i}
        OR LOWER(COALESCE(h.documento,'')) LIKE $${i}
        OR LOWER(COALESCE(h.email,'')) LIKE $${i}
        OR LOWER(COALESCE(h.telefono,'')) LIKE $${i}
      )
    `);
  }

  // 📅 Filtro por rango (huéspedes con reservas que TOQUEN el rango)
  if (desde && hasta) {
    params.push(desde);
    const idxDesde = params.length;
    params.push(hasta);
    const idxHasta = params.length;

    filtros.push(`
      h.id IN (
        SELECT DISTINCT r.huesped_id
        FROM reservas r
        WHERE r.huesped_id IS NOT NULL
          AND daterange(r.fecha_inicio, r.fecha_fin, '[)') && daterange($${idxDesde}, $${idxHasta}, '[)')
      )
    `);
  }

  const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

  try {
    const qH = `
      SELECT
        h.id,

        -- ✅ siempre devolvemos un nombre completo usable
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', h.nombres, h.primer_apellido, h.segundo_apellido)), ''),
          NULLIF(TRIM(h.nombre), ''),
          '—'
        ) AS nombre_completo,

        h.tipo_documento,
        h.documento,
        h.nombres,
        h.primer_apellido,
        h.segundo_apellido,
        h.fecha_nacimiento,
        h.fecha_expedicion,
        h.telefono,
        h.email,
        h.nacionalidad,
        h.ciudad,
        h.direccion,
        h.created_at,
        h.updated_at,
        MAX(r.fecha_inicio) AS ultima_estadia

      FROM huespedes h
      LEFT JOIN reservas r ON r.huesped_id = h.id
      ${where}
      GROUP BY h.id
      ORDER BY
        -- ✅ ordenar por apellido/nombres si existen; si no, por nombre viejo
        COALESCE(NULLIF(TRIM(h.primer_apellido), ''), NULLIF(TRIM(h.nombre), ''), 'zzz') ASC,
        COALESCE(NULLIF(TRIM(h.nombres), ''), 'zzz') ASC
      LIMIT 200
    `;

    const { rows } = await pool.query(qH, params);
    res.json(rows);
  } catch (e) {
    console.error("listarHuespedes error:", e);
    res.status(500).json({ message: "Error al listar huéspedes." });
  }
};

//
// GET /api/huespedes/:id
//
export const obtenerHuesped = async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `
      SELECT
        id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', nombres, primer_apellido, segundo_apellido)), ''),
          NULLIF(TRIM(nombre), ''),
          '—'
        ) AS nombre_completo,
        nombre,
        tipo_documento,
        documento,
        nombres,
        primer_apellido,
        segundo_apellido,
        fecha_nacimiento,
        fecha_expedicion,
        telefono,
        email,
        nacionalidad,
        ciudad,
        direccion,
        created_at,
        updated_at
      FROM huespedes
      WHERE id = $1
      LIMIT 1
      `,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Huésped no encontrado." });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerHuesped error:", e);
    res.status(500).json({ message: "Error al obtener huésped." });
  }
};

//
// POST /api/huespedes
//
export const crearHuesped = async (req, res) => {
  const {
    nombres,
    primer_apellido,
    segundo_apellido,
    tipo_documento,
    documento,
    fecha_nacimiento,
    fecha_expedicion,
    telefono,
    email,
    nacionalidad,
    ciudad,
    direccion,
  } = req.body;

  // ✅ mínimo
  if (!nombres?.trim() || !primer_apellido?.trim()) {
    return res
      .status(400)
      .json({ message: "Nombres y primer apellido son obligatorios." });
  }

  const nombreCompleto = buildNombreCompleto(
    nombres,
    primer_apellido,
    segundo_apellido
  );

  try {
    const { rows } = await pool.query(
      `
      INSERT INTO huespedes
      (
        nombre,
        nombres, primer_apellido, segundo_apellido,
        tipo_documento, documento,
        fecha_nacimiento, fecha_expedicion,
        telefono, email,
        nacionalidad, ciudad, direccion,
        created_at, updated_at
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
      RETURNING *
      `,
      [
        nombreCompleto,
        nombres.trim(),
        primer_apellido.trim(),
        segundo_apellido?.trim() || null,
        tipo_documento || null,
        documento?.trim() || null,
        fecha_nacimiento || null,
        fecha_expedicion || null,
        telefono?.trim() || null,
        email?.trim() || null,
        nacionalidad?.trim() || null,
        ciudad?.trim() || null,
        direccion?.trim() || null,
      ]
    );

    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("crearHuesped error:", e);
    res.status(500).json({ message: "Error al crear huésped." });
  }
};

//
// PUT /api/huespedes/:id
//
export const actualizarHuesped = async (req, res) => {
  const { id } = req.params;

  const {
    nombres,
    primer_apellido,
    segundo_apellido,
    tipo_documento,
    documento,
    fecha_nacimiento,
    fecha_expedicion,
    telefono,
    email,
    nacionalidad,
    ciudad,
    direccion,
  } = req.body;

  // ✅ mínimo
  if (!nombres?.trim() || !primer_apellido?.trim()) {
    return res
      .status(400)
      .json({ message: "Nombres y primer apellido son obligatorios." });
  }

  const nombreCompleto = buildNombreCompleto(
    nombres,
    primer_apellido,
    segundo_apellido
  );

  try {
    const { rows } = await pool.query(
      `
      UPDATE huespedes
      SET
        nombre = $1,
        nombres = $2,
        primer_apellido = $3,
        segundo_apellido = $4,
        tipo_documento = $5,
        documento = $6,
        fecha_nacimiento = $7,
        fecha_expedicion = $8,
        telefono = $9,
        email = $10,
        nacionalidad = $11,
        ciudad = $12,
        direccion = $13,
        updated_at = NOW()
      WHERE id = $14
      RETURNING *
      `,
      [
        nombreCompleto,
        nombres.trim(),
        primer_apellido.trim(),
        segundo_apellido?.trim() || null,
        tipo_documento || null,
        documento?.trim() || null,
        fecha_nacimiento || null,
        fecha_expedicion || null,
        telefono?.trim() || null,
        email?.trim() || null,
        nacionalidad?.trim() || null,
        ciudad?.trim() || null,
        direccion?.trim() || null,
        id,
      ]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Huésped no encontrado." });
    }

    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarHuesped error:", e);
    res.status(500).json({ message: "Error al actualizar huésped." });
  }
};


// GET /api/huespedes/buscar?tipo_documento=CC&documento=123
export const buscarHuespedPorDocumento = async (req, res) => {
  const td = (req.query.tipo_documento || "").trim().toUpperCase();
  const doc = (req.query.documento || "").trim();

  if (!td || !doc) {
    return res.status(400).json({ message: "Debe enviar tipo_documento y documento." });
  }

  try {
    const q = await pool.query(
      `
      SELECT
        id,
        nombre,
        tipo_documento,
        documento,
        numero_documento,
        telefono,
        email,
        direccion,
        fecha_nacimiento,
        nombres,
        primer_apellido,
        segundo_apellido,
        fecha_expedicion,
        nacionalidad,
        ciudad
      FROM huespedes
      WHERE upper(trim(tipo_documento)) = $1
        AND trim(COALESCE(documento, numero_documento, '')) = $2
      LIMIT 1
      `,
      [td, doc]
    );

    if (!q.rows.length) return res.status(404).json({ message: "Huésped no encontrado." });
    return res.json(q.rows[0]);
  } catch (e) {
    console.error("buscarHuespedPorDocumento error:", e);
    return res.status(500).json({ message: "Error interno al buscar huésped." });
  }
};

export const listarHuespedesFiltrados = async (req, res) => {
  try {
    const {
      q = "",
      desde = "",   // YYYY-MM-DD — first_ingreso >= desde
      hasta = "",   // YYYY-MM-DD — first_ingreso <= hasta
      page = "1",
      limit = "20",
    } = req.query;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset = (pageNum - 1) * limitNum;

    const text = String(q || "").trim();

    const where = [];
    const params = [];

    if (text) {
      params.push(`%${text.toLowerCase()}%`);
      where.push(`
        (
          lower(coalesce(hu.documento,'')) LIKE $${params.length}
          OR lower(coalesce(hu.nombre,'')) LIKE $${params.length}
          OR lower(trim(concat_ws(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido))) LIKE $${params.length}
        )
      `);
    }

    if (desde.trim()) {
      params.push(desde.trim());
      where.push(`first_ingreso::date >= $${params.length}::date`);
    }

    if (hasta.trim()) {
      params.push(hasta.trim());
      where.push(`first_ingreso::date <= $${params.length}::date`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    // subquery: fecha de ingreso por huésped (primer checkin o primera creación de reserva como titular)
    const base = `
      WITH ingresos AS (
        SELECT
          rh.huesped_id,
          MIN(COALESCE(r.checkin_at, r.created_at, r.fecha_inicio)) AS first_ingreso
        FROM reserva_huespedes rh
        JOIN reservas r ON r.id = rh.reserva_id
        WHERE rh.rol = 'titular'
        GROUP BY rh.huesped_id
      )
      SELECT
        hu.id,
        hu.tipo_documento,
        hu.documento,
        hu.nombre,
        hu.nombres,
        hu.primer_apellido,
        hu.segundo_apellido,
        hu.telefono,
        hu.email,
        hu.nacionalidad,
        hu.ciudad,
        hu.direccion,
        i.first_ingreso
      FROM huespedes hu
      LEFT JOIN ingresos i ON i.huesped_id = hu.id
    `;

    // total
    const qTotal = `
      SELECT COUNT(*)::int AS total
      FROM (${base} ${whereSql}) x
    `;
    const rTotal = await pool.query(qTotal, params);
    const total = rTotal.rows?.[0]?.total || 0;

    // data
    params.push(limitNum);
    params.push(offset);

    const qData = `
      ${base}
      ${whereSql}
      ORDER BY (i.first_ingreso IS NULL) ASC, i.first_ingreso DESC, hu.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;

    const rData = await pool.query(qData, params);

    return res.json({
      page: pageNum,
      limit: limitNum,
      total,
      items: rData.rows,
    });
  } catch (e) {
    console.error("listarHuespedesFiltrados error:", e);
    return res.status(500).json({ message: "Error al listar huéspedes." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/huespedes/:id/historial  — RF-06: Historial de estancias por huésped
// ─────────────────────────────────────────────────────────────────────────────
export const historialHuesped = async (req, res) => {
  const { id } = req.params;
  try {
    // Reservas como titular
    const { rows: titular } = await pool.query(
      `SELECT
         r.id, r.fecha_inicio, r.fecha_fin, r.estado, r.plan, r.fuente, r.notas,
         h.numero AS habitacion_numero, h.tipo AS habitacion_tipo,
         COALESCE(SUM(CASE WHEN p.tipo='pago'     THEN p.monto ELSE 0 END),0)::numeric AS total_pagado,
         COALESCE(SUM(CASE WHEN p.tipo='deposito' THEN p.monto ELSE 0 END),0)::numeric AS depositos,
         'titular' AS rol
       FROM reservas r
       JOIN habitaciones h ON h.id = r.habitacion_id
       LEFT JOIN pagos p   ON p.reserva_id = r.id
       WHERE r.huesped_id = $1
       GROUP BY r.id, h.numero, h.tipo
       ORDER BY r.fecha_inicio DESC`,
      [id]
    );

    // Reservas como acompañante
    const { rows: acomp } = await pool.query(
      `SELECT
         r.id, r.fecha_inicio, r.fecha_fin, r.estado, r.plan, r.fuente, r.notas,
         h.numero AS habitacion_numero, h.tipo AS habitacion_tipo,
         0::numeric AS total_pagado, 0::numeric AS depositos,
         'acompanante' AS rol
       FROM reserva_huespedes rh
       JOIN reservas r     ON r.id = rh.reserva_id
       JOIN habitaciones h ON h.id = r.habitacion_id
       WHERE rh.huesped_id = $1 AND r.huesped_id != $1
       ORDER BY r.fecha_inicio DESC`,
      [id]
    );

    const todas      = [...titular, ...acomp];
    const finalizadas = todas.filter(r => r.estado === 'finalizada');
    const totalNoches = finalizadas.reduce((acc, r) => {
      return acc + Math.max(0, Math.round((new Date(r.fecha_fin) - new Date(r.fecha_inicio)) / 86400000));
    }, 0);
    const totalPagado = titular.reduce((acc, r) => acc + Number(r.total_pagado), 0);

    res.json({
      estadisticas: {
        total_estadias:       titular.length,
        estadias_titular:     titular.length,
        estadias_acompanante: acomp.length,
        estancias_finalizadas: finalizadas.length,
        total_noches:         totalNoches,
        promedio_noches:      finalizadas.length ? Math.round(totalNoches / finalizadas.length) : 0,
        total_pagado:         totalPagado,
        primera_visita:       titular.length ? titular[titular.length - 1].fecha_inicio : null,
        ultima_visita:        titular.length ? titular[0].fecha_inicio : null,
      },
      reservas: todas.sort((a, b) => new Date(b.fecha_inicio) - new Date(a.fecha_inicio)),
    });
  } catch (e) {
    console.error("historialHuesped error:", e);
    res.status(500).json({ message: "Error al obtener historial del huésped." });
  }
};

// GET /api/huespedes/:id/pagos — Historial de pagos consolidado del huésped
export const pagosPorHuesped = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         p.id, p.reserva_id, p.tipo, p.metodo, p.monto, p.referencia, p.created_at,
         h.numero AS habitacion_numero, h.tipo AS habitacion_tipo,
         r.fecha_inicio, r.fecha_fin
       FROM pagos p
       JOIN reservas r ON r.id = p.reserva_id
       JOIN habitaciones h ON h.id = r.habitacion_id
       WHERE r.huesped_id = $1
       ORDER BY p.created_at DESC`,
      [id]
    );
    res.json(rows);
  } catch (e) {
    console.error("pagosPorHuesped error:", e);
    res.status(500).json({ message: "Error al obtener pagos del huésped." });
  }
};
