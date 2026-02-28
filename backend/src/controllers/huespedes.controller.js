
import { pool } from "../config/database.js";

const buildNombreCompleto = (nombres, primer_apellido, segundo_apellido) =>
  [nombres, primer_apellido, segundo_apellido]
    .map((x) => (x || "").trim()).filter(Boolean).join(" ").trim();


// GET /api/huespedes?q=texto&page=1&limit=20

export const listarHuespedes = async (req, res) => {
  try {
    const { q = "", page = "1", limit = "20" } = req.query;

    const pageNum  = Math.max(1, Number(page)  || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;
    const text     = String(q || "").trim();

    const where  = [];
    const params = [];

    if (text) {
      params.push(`%${text.toLowerCase()}%`);
      where.push(`(
        lower(coalesce(hu.documento,''))   LIKE $${params.length}
        OR lower(coalesce(hu.nombre,''))   LIKE $${params.length}
        OR lower(trim(concat_ws(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido))) LIKE $${params.length}
        OR lower(coalesce(hu.email,''))    LIKE $${params.length}
        OR lower(coalesce(hu.telefono,'')) LIKE $${params.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const base = `
      WITH ultima AS (
        SELECT r.huesped_id,
               MAX(r.fecha_inicio)  AS ultima_estadia,
               COUNT(*)::int        AS total_estadias
        FROM reservas r
        WHERE r.huesped_id IS NOT NULL
          AND r.estado NOT IN ('cancelada')
        GROUP BY r.huesped_id
      )
      SELECT
        hu.id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)),''),
          NULLIF(TRIM(hu.nombre),''), '—'
        ) AS nombre_completo,
        hu.tipo_documento, hu.documento,
        hu.nombres, hu.primer_apellido, hu.segundo_apellido,
        hu.fecha_nacimiento, hu.fecha_expedicion,
        hu.telefono, hu.email,
        hu.nacionalidad, hu.ciudad, hu.direccion,
        hu.created_at, hu.updated_at,
        u.ultima_estadia,
        COALESCE(u.total_estadias, 0) AS total_estadias
      FROM huespedes hu
      LEFT JOIN ultima u ON u.huesped_id = hu.id
    `;

    const qTotal = `SELECT COUNT(*)::int AS total FROM (${base} ${whereSql}) x`;
    const rTotal = await pool.query(qTotal, params);
    const total  = rTotal.rows[0]?.total || 0;

    params.push(limitNum, offset);
    const qData = `
      ${base}
      ${whereSql}
      ORDER BY (u.ultima_estadia IS NULL) ASC, u.ultima_estadia DESC, hu.id DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `;
    const rData = await pool.query(qData, params);

    return res.json({ page: pageNum, limit: limitNum, total, items: rData.rows });
  } catch (e) {
    console.error("listarHuespedes error:", e);
    res.status(500).json({ message: "Error al listar huéspedes." });
  }
};


// GET /api/huespedes/:id

export const obtenerHuesped = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT id,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', nombres, primer_apellido, segundo_apellido)),''),
          NULLIF(TRIM(nombre),''), '—'
        ) AS nombre_completo,
        nombre, tipo_documento, documento,
        nombres, primer_apellido, segundo_apellido,
        fecha_nacimiento, fecha_expedicion,
        telefono, email, nacionalidad, ciudad, direccion,
        created_at, updated_at
      FROM huespedes WHERE id = $1 LIMIT 1
    `, [id]);
    if (!rows.length) return res.status(404).json({ message: "Huésped no encontrado." });
    res.json(rows[0]);
  } catch (e) {
    console.error("obtenerHuesped error:", e);
    res.status(500).json({ message: "Error al obtener huésped." });
  }
};


// GET /api/huespedes/:id/estadias

export const obtenerEstadiasHuesped = async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(`
      SELECT
        r.id           AS reserva_id,
        r.fecha_inicio, r.fecha_fin,
        r.estado, r.notas, r.plan, r.fuente,
        h.numero       AS habitacion_numero,
        h.tipo         AS habitacion_tipo,
        (r.fecha_fin::date - r.fecha_inicio::date) AS noches,
        rh.rol
      FROM reserva_huespedes rh
      JOIN reservas     r ON r.id  = rh.reserva_id
      JOIN habitaciones h ON h.id  = r.habitacion_id
      WHERE rh.huesped_id = $1
      ORDER BY r.fecha_inicio DESC
    `, [id]);
    res.json(rows);
  } catch (e) {
    console.error("obtenerEstadiasHuesped error:", e);
    res.status(500).json({ message: "Error al obtener estadías." });
  }
};


// POST /api/huespedes

export const crearHuesped = async (req, res) => {
  const {
    nombres, primer_apellido, segundo_apellido,
    tipo_documento, documento, fecha_nacimiento, fecha_expedicion,
    telefono, email, nacionalidad, ciudad, direccion,
  } = req.body;

  if (!nombres?.trim() || !primer_apellido?.trim())
    return res.status(400).json({ message: "Nombres y primer apellido son obligatorios." });

  //  Validar documento duplicado
  if (tipo_documento && documento?.trim()) {
    const dup = await pool.query(
      `SELECT id FROM huespedes
       WHERE upper(trim(tipo_documento)) = upper($1)
         AND trim(coalesce(documento,'')) = trim($2) LIMIT 1`,
      [tipo_documento, documento.trim()]
    );
    if (dup.rows.length)
      return res.status(409).json({
        message: `Ya existe un huésped con ${tipo_documento} ${documento.trim()}.`,
        huesped_id: dup.rows[0].id,
      });
  }

  const nombreCompleto = buildNombreCompleto(nombres, primer_apellido, segundo_apellido);
  try {
    const { rows } = await pool.query(`
      INSERT INTO huespedes
        (nombre, nombres, primer_apellido, segundo_apellido,
         tipo_documento, documento, fecha_nacimiento, fecha_expedicion,
         telefono, email, nacionalidad, ciudad, direccion,
         created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW())
      RETURNING *
    `, [
      nombreCompleto, nombres.trim(), primer_apellido.trim(),
      segundo_apellido?.trim() || null, tipo_documento || null,
      documento?.trim() || null, fecha_nacimiento || null,
      fecha_expedicion || null, telefono?.trim() || null,
      email?.trim() || null, nacionalidad?.trim() || null,
      ciudad?.trim() || null, direccion?.trim() || null,
    ]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error("crearHuesped error:", e);
    res.status(500).json({ message: "Error al crear huésped." });
  }
};


// PUT /api/huespedes/:id

export const actualizarHuesped = async (req, res) => {
  const { id } = req.params;
  const {
    nombres, primer_apellido, segundo_apellido,
    tipo_documento, documento, fecha_nacimiento, fecha_expedicion,
    telefono, email, nacionalidad, ciudad, direccion,
  } = req.body;

  if (!nombres?.trim() || !primer_apellido?.trim())
    return res.status(400).json({ message: "Nombres y primer apellido son obligatorios." });

  //  Validar documento duplicado en otro huésped
  if (tipo_documento && documento?.trim()) {
    const dup = await pool.query(
      `SELECT id FROM huespedes
       WHERE upper(trim(tipo_documento)) = upper($1)
         AND trim(coalesce(documento,'')) = trim($2)
         AND id <> $3 LIMIT 1`,
      [tipo_documento, documento.trim(), id]
    );
    if (dup.rows.length)
      return res.status(409).json({ message: "Ese documento ya está registrado en otro huésped." });
  }

  const nombreCompleto = buildNombreCompleto(nombres, primer_apellido, segundo_apellido);
  try {
    const { rows } = await pool.query(`
      UPDATE huespedes SET
        nombre = $1, nombres = $2, primer_apellido = $3, segundo_apellido = $4,
        tipo_documento = $5, documento = $6,
        fecha_nacimiento = $7, fecha_expedicion = $8,
        telefono = $9, email = $10,
        nacionalidad = $11, ciudad = $12, direccion = $13,
        updated_at = NOW()
      WHERE id = $14
      RETURNING *
    `, [
      nombreCompleto, nombres.trim(), primer_apellido.trim(),
      segundo_apellido?.trim() || null, tipo_documento || null,
      documento?.trim() || null, fecha_nacimiento || null,
      fecha_expedicion || null, telefono?.trim() || null,
      email?.trim() || null, nacionalidad?.trim() || null,
      ciudad?.trim() || null, direccion?.trim() || null, id,
    ]);
    if (!rows.length) return res.status(404).json({ message: "Huésped no encontrado." });
    res.json(rows[0]);
  } catch (e) {
    console.error("actualizarHuesped error:", e);
    res.status(500).json({ message: "Error al actualizar huésped." });
  }
};


// GET /api/huespedes/buscar?tipo_documento=CC&documento=123

export const buscarHuespedPorDocumento = async (req, res) => {
  const td  = (req.query.tipo_documento || "").trim().toUpperCase();
  const doc = (req.query.documento || "").trim();
  if (!td || !doc)
    return res.status(400).json({ message: "Debe enviar tipo_documento y documento." });
  try {
    const { rows } = await pool.query(`
      SELECT id, nombre, tipo_documento, documento, numero_documento,
             telefono, email, direccion, fecha_nacimiento,
             nombres, primer_apellido, segundo_apellido,
             fecha_expedicion, nacionalidad, ciudad
      FROM huespedes
      WHERE upper(trim(tipo_documento)) = $1
        AND trim(COALESCE(documento, numero_documento, '')) = $2
      LIMIT 1
    `, [td, doc]);
    if (!rows.length) return res.status(404).json({ message: "Huésped no encontrado." });
    return res.json(rows[0]);
  } catch (e) {
    console.error("buscarHuespedPorDocumento error:", e);
    res.status(500).json({ message: "Error al buscar huésped." });
  }
};