// src/controllers/cargos.controller.js
import { pool } from "../config/database.js";
import dayjs from "dayjs";

// GET /api/reservas/:id/cargos
export const listarCargosReserva = async (req, res) => {
  const reservaId = Number(req.params.id);
  if (!reservaId || Number.isNaN(reservaId)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  try {
    const q = await pool.query(
      `
      SELECT
        c.*,
        h.numero AS habitacion_numero
      FROM cargos_reserva c
      JOIN habitaciones h ON h.id = c.habitacion_id
      WHERE c.reserva_id = $1
      ORDER BY c.created_at ASC
      `,
      [reservaId]
    );

    const total_activo = q.rows
      .filter((x) => x.estado === "activo")
      .reduce((acc, x) => acc + Number(x.valor_total || 0), 0);

    return res.json({ cargos: q.rows, total_activo });
  } catch (e) {
    console.error("listarCargosReserva error:", e);
    return res.status(500).json({ message: "Error al listar cargos." });
  }
};

// POST /api/reservas/:id/cargos
export const crearCargoReserva = async (req, res) => {
  const reservaId = Number(req.params.id);
  if (!reservaId || Number.isNaN(reservaId)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  const {
    categoria = "otro",
    concepto,
    cantidad = 1,
    valor_unitario = 0,
    fecha_cargo = null,
    observacion = null,
  } = req.body || {};

  if (!concepto || !String(concepto).trim()) {
    return res.status(400).json({ message: "El concepto es obligatorio." });
  }

  const cant = Number(cantidad);
  const vu = Number(valor_unitario);
  if (!(cant > 0) || !(vu >= 0)) {
    return res.status(400).json({ message: "Cantidad o valor unitario inválidos." });
  }

  const fecha = fecha_cargo ? dayjs(fecha_cargo).format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD");
  const total = cant * vu;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // validar reserva + habitacion
    const r = await client.query(
      `SELECT id, estado, habitacion_id FROM reservas WHERE id = $1 LIMIT 1`,
      [reservaId]
    );
    if (!r.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = r.rows[0];

    // regla: cargos solo si está ocupada (puedes cambiarlo si quieres)
    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Solo puedes agregar cargos a una reserva ocupada (check-in)." });
    }

    const ins = await client.query(
      `
      INSERT INTO cargos_reserva
        (reserva_id, habitacion_id, categoria, concepto, cantidad, valor_unitario, valor_total, fecha_cargo, estado, observacion, created_at, updated_at)
      VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,'activo',$9,NOW(),NOW())
      RETURNING *
      `,
      [
        reservaId,
        reserva.habitacion_id,
        String(categoria).trim().toLowerCase(),
        String(concepto).trim(),
        cant,
        vu,
        total,
        fecha,
        observacion ? String(observacion).trim() : null,
      ]
    );

    await client.query("COMMIT");
    return res.status(201).json(ins.rows[0]);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("crearCargoReserva error:", e);
    return res.status(500).json({ message: "Error creando cargo." });
  } finally {
    client.release();
  }
};

// POST /api/cargos/:cargoId/anular
export const anularCargo = async (req, res) => {
  const cargoId = Number(req.params.cargoId);
  if (!cargoId || Number.isNaN(cargoId)) {
    return res.status(400).json({ message: "ID de cargo inválido." });
  }

  try {
    const r = await pool.query(
      `
      UPDATE cargos_reserva
      SET estado = 'anulado', updated_at = NOW()
      WHERE id = $1
      RETURNING id, estado
      `,
      [cargoId]
    );
    if (!r.rows.length) return res.status(404).json({ message: "Cargo no encontrado." });
    return res.json({ ok: true, cargo: r.rows[0] });
  } catch (e) {
    console.error("anularCargo error:", e);
    return res.status(500).json({ message: "Error anulando cargo." });
  }
};

// ✅ Genera (una sola vez) el cargo de alojamiento para la reserva
export const generarCargoAlojamientoReserva = async (client, reservaId) => {
  // 1) Verificar reserva + habitacion
  const r = await client.query(
    `
    SELECT r.id, r.habitacion_id, h.numero AS habitacion_numero
    FROM reservas r
    JOIN habitaciones h ON h.id = r.habitacion_id
    WHERE r.id = $1
    LIMIT 1
    `,
    [reservaId]
  );

  if (!r.rows.length) {
    throw new Error("Reserva no encontrada para generar cargo alojamiento.");
  }

  const reserva = r.rows[0];

  // 2) Evitar duplicado: si ya existe cargo alojamiento activo, no crear otro
  const ex = await client.query(
    `
    SELECT id
    FROM cargos_reserva
    WHERE reserva_id = $1
      AND categoria = 'alojamiento'
      AND estado = 'activo'
    LIMIT 1
    `,
    [reservaId]
  );

  if (ex.rows.length) {
    return { ok: true, created: false, message: "Ya existe cargo de alojamiento." };
  }

  // 3) Crear cargo alojamiento (por ahora en 0 si aún no calculas tarifas aquí)
  //    Luego lo ajustas para poner el valor real.
  const ins = await client.query(
    `
    INSERT INTO cargos_reserva
      (reserva_id, habitacion_id, categoria, concepto, cantidad, valor_unitario, valor_total, fecha_cargo, estado, created_at, updated_at)
    VALUES
      ($1,$2,'alojamiento',$3,1,0,0,CURRENT_DATE,'activo',NOW(),NOW())
    RETURNING *
    `,
    [
      reservaId,
      reserva.habitacion_id,
      `Alojamiento Hab. ${reserva.habitacion_numero}`,
    ]
  );

  return { ok: true, created: true, cargo: ins.rows[0] };
};
