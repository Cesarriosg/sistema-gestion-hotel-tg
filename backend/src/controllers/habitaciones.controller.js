import { pool } from "../config/database.js";

export const crearHabitacion = async (req, res) => {
  try {
    const { numero, tipo, capacidad } = req.body;
    if (!numero) return res.status(400).json({ error: "numero es requerido" });
    const q = `INSERT INTO habitaciones (numero, tipo, capacidad)
               VALUES ($1,$2,$3) RETURNING *`;
    const { rows } = await pool.query(q, [numero, tipo, capacidad || 1]);
    res.status(201).json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
};


export const listarHabitaciones = async (req, res) => {
  try {
    const query = `
      SELECT 
        h.id,
        h.numero,
        h.tipo,
        h.capacidad,
        CASE
          WHEN EXISTS (
            SELECT 1 FROM reservas r
            WHERE r.habitacion_id = h.id
            AND r.estado = 'en_estancia'
          ) THEN 'ocupada'

          WHEN EXISTS (
            SELECT 1 FROM reservas r
            WHERE r.habitacion_id = h.id
            AND r.estado IN ('pendiente','confirmada')
            AND CURRENT_DATE BETWEEN r.fecha_inicio AND r.fecha_fin
          ) THEN 'ocupada'

          WHEN EXISTS (
            SELECT 1 FROM reservas r
            WHERE r.habitacion_id = h.id
            AND r.estado IN ('pendiente','confirmada')
            AND CURRENT_DATE < r.fecha_inicio
          ) THEN 'reservada'

          ELSE 'disponible'
        END AS estado_real
      FROM habitaciones h
      ORDER BY h.numero;
    `;

    const result = await pool.query(query);
    return res.json(result.rows);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error obteniendo habitaciones" });
  }
};



export const obtenerHabitacion = async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM habitaciones WHERE id=$1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const actualizarHabitacion = async (req, res) => {
  try {
    const { numero, tipo, estado, capacidad } = req.body;
    const q = `UPDATE habitaciones SET
               numero=COALESCE($1,numero),
               tipo=COALESCE($2,tipo),
               estado=COALESCE($3,estado),
               capacidad=COALESCE($4,capacidad),
               updated_at=NOW()
               WHERE id=$5 RETURNING *`;
    const { rows } = await pool.query(q, [numero, tipo, estado, capacidad, req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "No encontrada" });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

export const listarDisponibles = async (req, res) => {
  try {
    const { inicio, fin, tipo, capacidad } = req.query;
    if (!inicio || !fin) {
      return res.status(400).json({ error: "Parámetros 'inicio' y 'fin' son requeridos" });
    }

    // habitaciones que NO tengan reservas solapadas en el rango
    // lógica: seleccionar habitaciones h
    // donde NO EXISTE una reserva r con solapamiento
    let q = `
      SELECT h.*
      FROM habitaciones h
      WHERE h.id NOT IN (
        SELECT habitacion_id
        FROM reservas
        WHERE estado IN ('pendiente','confirmada')
          AND ($1 <= fecha_fin) AND ($2 >= fecha_inicio)
      )
    `;
    const params = [inicio, fin];

    if (tipo) {
      params.push(tipo);
      q += ` AND h.tipo = $${params.length}`;
    }
    if (capacidad) {
      params.push(Number(capacidad));
      q += ` AND h.capacidad >= $${params.length}`;
    }

    q += " ORDER BY h.numero ASC";

    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
};

