
import { pool } from "../config/database.js";

const ESTADOS_VALIDOS = [
  "disponible",
  "reservada",
  "ocupada",
  "mantenimiento",
  "fuera_servicio",
];

export const listarHabitaciones = async (req, res) => {
  try {
    const { estado = "", tipo = "", q = "" } = req.query;

    const filtros = [];
    const params = [];

    if (estado && estado !== "todas") {
      params.push(String(estado).trim());
      filtros.push(`h.estado = $${params.length}`);
    }

    if (tipo && tipo !== "todas") {
      params.push(String(tipo).trim());
      filtros.push(`h.tipo = $${params.length}`);
    }

    if (q && q.trim()) {
      params.push(`%${q.trim()}%`);
      filtros.push(`(CAST(h.numero AS TEXT) ILIKE $${params.length})`);
    }

    const where = filtros.length ? `WHERE ${filtros.join(" AND ")}` : "";

    const sql = `
  SELECT
    h.id, h.numero, h.tipo, h.estado AS estado_base, h.capacidad, h.activo, h.updated_at,
    -- Estado operativo hoy: si hay reserva/ocupación activa hoy según fecha sistema, prima sobre estado_base
    COALESCE(
      (
        SELECT r.estado
        FROM reservas r
        WHERE r.habitacion_id = h.id
          AND r.estado IN ('ocupada', 'reservada')
          AND r.fecha_inicio <= (
            SELECT COALESCE(fecha_sistema, CURRENT_DATE) FROM configuracion LIMIT 1
          )
          AND r.fecha_fin > (
            SELECT COALESCE(fecha_sistema, CURRENT_DATE) FROM configuracion LIMIT 1
          )
        ORDER BY r.fecha_inicio DESC
        LIMIT 1
      ),
      h.estado
    ) AS estado_operativo
  FROM habitaciones h
  ${where}
  ORDER BY h.numero ASC
`;


    const r = await pool.query(sql, params);
    res.json(r.rows);
  } catch (e) {
    console.error("listarHabitaciones error:", e);
    res.status(500).json({ message: "Error al listar habitaciones." });
  }
};


// GET /api/habitaciones/por-numero/:numero
export const obtenerHabitacionPorNumero = async (req, res) => {
  const { numero } = req.params;
  try {
    const q = await pool.query(
      "SELECT id, numero, tipo, estado FROM habitaciones WHERE TRIM(numero) = TRIM($1) LIMIT 1",
      [numero]
    );
    if (!q.rows.length) return res.status(404).json({ message: "Habitación no existe." });
    return res.json(q.rows[0]);
  } catch (e) {
    console.error("obtenerHabitacionPorNumero error:", e);
    return res.status(500).json({ message: "Error interno." });
  }
};


export const cambiarTipoHabitacion = async (req, res) => {
  const { id } = req.params;
  const { tipo } = req.body || {};

  const t = (tipo || "").trim();
  if (!t) return res.status(400).json({ message: "Tipo es obligatorio." });

  try {
    // validar tipo activo
    const tipoOk = await pool.query(
      "SELECT id FROM tipos_habitacion WHERE LOWER(nombre)=LOWER($1) AND activo=true LIMIT 1",
      [t]
    );
    if (!tipoOk.rows.length) {
      return res.status(400).json({ message: "Tipo inválido o inactivo." });
    }

    const upd = await pool.query(
      `
      UPDATE habitaciones
      SET tipo=$1, updated_at=NOW()
      WHERE id=$2
      RETURNING id, numero, tipo, estado, capacidad, updated_at
      `,
      [t, id]
    );

    if (!upd.rows.length) return res.status(404).json({ message: "Habitación no encontrada." });

    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("cambiarTipoHabitacion error:", e);
    return res.status(500).json({ message: "Error cambiando tipo." });
  }
};

// POST /api/habitaciones
export const crearHabitacion = async (req, res) => {
  const { numero, tipo, capacidad } = req.body || {};

  const num = String(numero || "").trim();
  const tip = String(tipo || "").trim();
  const cap = Number(capacidad || 2);

  if (!num || !tip) {
    return res.status(400).json({ message: "Número y tipo son obligatorios." });
  }
  if (Number.isNaN(cap) || cap <= 0) {
    return res.status(400).json({ message: "Capacidad inválida." });
  }

  try {
    const tx = await pool.query(
      `SELECT id
       FROM tipos_habitacion
       WHERE LOWER(nombre) = LOWER($1)
         AND activo = true 
       LIMIT 1`,
      [tip]
    );

    if (!tx.rows.length) {
      return res.status(400).json({ message: "Tipo de habitación no existe o está inactivo." });
    }

    const ins = await pool.query(
      `INSERT INTO habitaciones (numero, tipo, estado, capacidad, activo, created_at, updated_at)
       VALUES ($1, $2, 'disponible', $3, true, NOW(), NOW())
       RETURNING id, numero, tipo, estado, capacidad, activo, updated_at`,
      [num, tip, cap]
    );

    return res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("crearHabitacion error:", e);
    if (String(e?.code) === "23505") {
      return res.status(409).json({ message: "Ya existe una habitación con ese número." });
    }
    return res.status(500).json({ message: "Error al crear habitación." });
  }
};

// PUT /api/habitaciones/:id/tipo
export const actualizarTipoHabitacionDeHab = async (req, res) => {
  const { id } = req.params;
  const { tipo } = req.body || {};
  const tip = String(tipo || "").trim();

  if (!tip) return res.status(400).json({ message: "Tipo requerido." });

  try {
    // validar que el tipo exista y esté activo
    const tx = await pool.query(
      `SELECT id FROM tipos_habitacion WHERE LOWER(nombre)=LOWER($1) AND activo=true LIMIT 1`,
      [tip]
    );
    if (!tx.rows.length) {
      return res.status(400).json({ message: "Tipo no existe o está inactivo." });
    }

    const upd = await pool.query(
      `
      UPDATE habitaciones
      SET tipo = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING id, numero, tipo, estado, capacidad, activo, updated_at
      `,
      [tip, id]
    );

    if (!upd.rows.length) return res.status(404).json({ message: "Habitación no encontrada." });
    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("actualizarTipoHabitacionDeHab error:", e);
    return res.status(500).json({ message: "Error al actualizar tipo." });
  }
};


// PUT /api/habitaciones/:id/activo
export const cambiarActivoHabitacion = async (req, res) => {
  const { id } = req.params;
  const { activo } = req.body || {};
  const nuevo = Boolean(activo);

  try {
    const cur = await pool.query("SELECT estado FROM habitaciones WHERE id=$1 LIMIT 1", [id]);
    if (!cur.rows.length) return res.status(404).json({ message: "Habitación no encontrada." });

    if (!nuevo && cur.rows[0].estado === "ocupada") {
      return res.status(400).json({ message: "No puedes desactivar una habitación ocupada." });
    }

    const upd = await pool.query(
      `UPDATE habitaciones SET activo=$1, updated_at=NOW() WHERE id=$2
       RETURNING id, numero, tipo, estado, capacidad, activo, updated_at`,
      [nuevo, id]
    );
    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("cambiarActivoHabitacion error:", e);
    return res.status(500).json({ message: "Error al activar/desactivar." });
  }
};

export const actualizarEstadoHabitacion = async (req, res) => {
  const { id } = req.params;
  const { estado } = req.body || {};

  const nuevo = String(estado || "").trim();

  if (!ESTADOS_VALIDOS.includes(nuevo)) {
    return res.status(400).json({
      message: `Estado inválido. Use: ${ESTADOS_VALIDOS.join(", ")}`
    });
  }

  try {
    const actual = await pool.query(
      `SELECT estado, activo FROM habitaciones WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (!actual.rows.length) {
      return res.status(404).json({ message: "Habitación no encontrada." });
    }

    const { estado: estadoActual, activo } = actual.rows[0];

    // Si está desactivada, no dejar cambiar estado 
    if (activo === false) {
      return res.status(400).json({ message: "No puedes cambiar estado de una habitación desactivada." });
    }

    // regla: no permitir mantenimiento/fuera_servicio si está ocupada
    if (
      (nuevo === "mantenimiento" || nuevo === "fuera_servicio") &&
      estadoActual === "ocupada"
    ) {
      return res.status(400).json({
        message:
          "No puedes poner en mantenimiento/fuera de servicio una habitación OCUPADA. Haz checkout primero."
      });
    }

    const upd = await pool.query(
      `UPDATE habitaciones
       SET estado = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, numero, tipo, estado, capacidad, activo, updated_at`,
      [nuevo, id]
    );

    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("actualizarEstadoHabitacion error:", e);
    return res.status(500).json({ message: "Error al actualizar estado de habitación." });
  }
};

// PUT /api/habitaciones/:id/notas
export const actualizarNotasHabitacion = async (req, res) => {
  const { id } = req.params;
  const { notas } = req.body || {};
  try {
    await pool.query(`ALTER TABLE habitaciones ADD COLUMN IF NOT EXISTS notas TEXT`);
    const upd = await pool.query(
      `UPDATE habitaciones SET notas=$1, updated_at=NOW() WHERE id=$2
       RETURNING id, numero, notas`,
      [notas || null, id]
    );
    if (!upd.rows.length) return res.status(404).json({ message: "Habitación no encontrada." });
    return res.json(upd.rows[0]);
  } catch (e) {
    console.error("actualizarNotasHabitacion error:", e);
    return res.status(500).json({ message: "Error al guardar notas." });
  }
};

export const actualizarPlanYTarifaHabitacion = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { plan, precio } = req.body || {};

    const planLimpio = String(plan || "").trim();
    const precioNum = Number(precio);

    if (!id || Number.isNaN(Number(id))) {
      return res.status(400).json({ message: "ID inválido." });
    }
    if (!planLimpio) {
      return res.status(400).json({ message: "Plan es obligatorio." });
    }
    if (Number.isNaN(precioNum) || precioNum <= 0) {
      return res.status(400).json({ message: "Precio inválido." });
    }

    await client.query("BEGIN");

    // 1) obtener la habitación (para saber su tipo actual)
    const habQ = await client.query(
      `SELECT id, tipo FROM habitaciones WHERE id=$1 LIMIT 1`,
      [id]
    );
    if (!habQ.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Habitación no encontrada." });
    }

    const tipoHabitacion = String(habQ.rows[0].tipo || "").trim();
    if (!tipoHabitacion) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La habitación no tiene tipo asignado." });
    }

    /*// 2) actualizar plan en habitación
    await client.query(
      `UPDATE habitaciones SET plan=$1, updated_at=NOW() WHERE id=$2`,
      [planLimpio, id]
    );*/

    // 3) upsert "tarifa base" en la tabla tarifas usando rango grande
    //    (esto es lo que hace que siempre exista una tarifa vigente)
    const fi = "2000-01-01";
    const ff = "2099-12-31";

    // si ya existe una tarifa base para ese plan+tipo en ese rango, la actualizamos
    const existe = await client.query(
      `
      SELECT id
      FROM tarifas
      WHERE plan = $1
        AND lower(trim(tipo_habitacion)) = lower(trim($2))
        AND fecha_inicio = $3::date
        AND fecha_fin = $4::date
      LIMIT 1
      `,
      [planLimpio, tipoHabitacion, fi, ff]
    );

    if (existe.rows.length) {
      await client.query(
        `
        UPDATE tarifas
        SET precio=$1, updated_at=NOW()
        WHERE id=$2
        `,
        [precioNum, existe.rows[0].id]
      );
    } else {
      await client.query(
        `
        INSERT INTO tarifas (tipo_habitacion, precio, fecha_inicio, fecha_fin, temporada, plan, created_at, updated_at)
        VALUES ($1, $2, $3::date, $4::date, $5, $6, NOW(), NOW())
        `,
        [tipoHabitacion, precioNum, fi, ff, "base", planLimpio]
      );
    }

    await client.query("COMMIT");
    return res.json({ message: "Plan y tarifa actualizados correctamente." });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("actualizarPlanYTarifaHabitacion error:", e);
    return res.status(500).json({ message: "Error actualizando plan y tarifa." });
  } finally {
    client.release();
  }
};






