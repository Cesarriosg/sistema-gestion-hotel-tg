
import { pool } from "../config/database.js";
import dayjs from "dayjs";

/**
 * Busca la tarifa aplicable para UNA fecha:
 * - match por plan + tipo_habitacion
 * - fecha dentro del rango [fecha_inicio, fecha_fin]
 * - si hay varias, prioriza temporada != 'base' (alta/baja/etc)
 */
const getTarifaPorFecha = async (client, { plan, tipoHabitacion, fecha }) => {
  const q = `
    SELECT precio, temporada
    FROM tarifas
    WHERE plan = $1
      AND tipo_habitacion = $2
      AND $3::date BETWEEN fecha_inicio AND fecha_fin
    ORDER BY
      CASE
        WHEN temporada IS NULL THEN 2
        WHEN temporada = 'base' THEN 2
        ELSE 1
      END
    LIMIT 1
  `;
  const r = await client.query(q, [plan, tipoHabitacion, fecha]);
  return r.rows[0] || null;
};

export const calcularTotalAlojamiento = async (client, { plan, tipoHabitacion, fechaInicio, fechaFin }) => {
  const inicio = dayjs(fechaInicio).startOf("day");
  const fin = dayjs(fechaFin).startOf("day");

  if (!fin.isAfter(inicio)) return { total: 0, noches: 0 };

  let total = 0;
  let cursor = inicio.clone();
  let noches = 0;

  while (cursor.isBefore(fin, "day")) {
    const fecha = cursor.format("YYYY-MM-DD");
    const tarifa = await getTarifaPorFecha(client, { plan, tipoHabitacion, fecha });

    if (!tarifa) {
      throw new Error(
        `No hay tarifa configurada para plan='${plan}', tipo='${tipoHabitacion}', fecha='${fecha}'.`
      );
    }

    total += Number(tarifa.precio);
    noches += 1;
    cursor = cursor.add(1, "day");
  }

  return { total, noches };
};




/**
 * GET /api/facturacion/facturas
 * Filtra por ?desde, ?hasta, ?estado
 */
export const listarFacturas = async (req, res) => {
  const { desde, hasta, estado } = req.query;

  const params = [];
  let where = "WHERE 1=1";

  if (desde) { params.push(desde); where += ` AND f.fecha_emision::date >= $${params.length}::date`; }
  if (hasta) { params.push(hasta); where += ` AND f.fecha_emision::date <= $${params.length}::date`; }
  if (estado) { params.push(estado); where += ` AND f.estado = $${params.length}`; }

  try {
    const q = `
      SELECT
        f.id,
        f.reserva_id,
        f.fecha_emision,
        f.total,
        f.estado,
        r.fecha_inicio,
        r.fecha_fin,
        r.plan,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)),''),
          NULLIF(TRIM(hu.nombre),''), ''
        ) AS huesped_nombre,
        COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.reserva_id = r.id AND p.tipo IN ('pago','deposito')), 0) AS total_pagado,
        CASE
          WHEN f.estado = 'anulada' THEN 'anulada'
          WHEN COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.reserva_id = r.id AND p.tipo IN ('pago','deposito')),0) >= f.total THEN 'pagada'
          WHEN COALESCE((SELECT SUM(p.monto) FROM pagos p WHERE p.reserva_id = r.id AND p.tipo IN ('pago','deposito')),0) > 0 THEN 'abonada'
          ELSE 'pendiente'
        END AS estado_pago
      FROM facturas f
      JOIN reservas r       ON r.id = f.reserva_id
      JOIN habitaciones h   ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      ${where}
      ORDER BY f.fecha_emision DESC, f.id DESC
    `;
    const { rows } = await pool.query(q, params);
    res.json(rows);
  } catch (e) {
    console.error("listarFacturas error:", e);
    res.status(500).json({ message: "Error al listar facturas." });
  }
};

/**
 * POST /api/facturacion/reservas/:id/facturar
 * Genera factura para reserva en estado 'ocupada'
 * Requiere al menos un pago/deposito registrado (según tu regla actual)
 */
export const facturarReserva = async (req, res) => {
  const { id } = req.params;
  const reservaId = Number(id);

  if (!reservaId || Number.isNaN(reservaId)) {
    return res.status(400).json({ message: "ID de reserva inválido." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Traer reserva + habitación + plan
    const r = await client.query(
      `
      SELECT
        r.id,
        r.fecha_inicio,
        r.fecha_fin,
        r.estado,
        r.facturada,
        r.plan,
        r.habitacion_id,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo
      FROM reservas r
      JOIN habitaciones h ON h.id = r.habitacion_id
      WHERE r.id = $1
      LIMIT 1
      `,
      [reservaId]
    );

    if (!r.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Reserva no encontrada." });
    }

    const reserva = r.rows[0];

    // 2) Solo facturar si está ocupada
    if (reserva.estado !== "ocupada") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Solo se puede facturar una reserva que esté actualmente ocupada (ya hizo check-in).",
      });
    }

    if (reserva.facturada) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La reserva ya tiene una factura generada." });
    }

    // 3) No duplicar factura
    const fExist = await client.query(
      "SELECT id FROM facturas WHERE reserva_id = $1 LIMIT 1",
      [reservaId]
    );
    if (fExist.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La reserva ya tiene una factura generada." });
    }

    // 4) Validar saldo = 0 antes de facturar
    const pagosRes = await client.query(
      `SELECT
         COALESCE(SUM(CASE WHEN tipo IN ('pago','deposito','descuento') THEN monto ELSE 0 END), 0) AS total_pagado,
         COALESCE(SUM(CASE WHEN tipo = 'cargo' THEN monto ELSE 0 END), 0) AS total_cargos
       FROM pagos
       WHERE reserva_id = $1`,
      [reservaId]
    );
    const totalPagado = Number(pagosRes.rows?.[0]?.total_pagado || 0);
    const totalCargosMovs = Number(pagosRes.rows?.[0]?.total_cargos || 0);

    if (totalPagado <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Registra al menos un depósito/pago antes de facturar.",
      });
    }

    // Validar que el saldo sea exactamente 0 (sin diferencia mayor a 1 peso)
    const saldoActual = totalCargosMovs - totalPagado;
    if (Math.abs(saldoActual) >= 1) {
      await client.query("ROLLBACK");
      const msg = saldoActual > 0
        ? `Saldo pendiente de $${Math.round(saldoActual).toLocaleString("es-CO")}. Registra el pago completo antes de facturar.`
        : `El total pagado supera el valor de la estancia en $${Math.round(Math.abs(saldoActual)).toLocaleString("es-CO")}. Elimina el excedente antes de facturar.`;
      return res.status(400).json({ message: msg });
    }

    // 5) Calcular alojamiento por tarifas (noche a noche)
    const plan = (reserva.plan || "C1").trim();
    const tipoHabitacion = reserva.habitacion_tipo;

    const { total: totalAlojamiento, noches } = await calcularTotalAlojamiento(client, {
      plan,
      tipoHabitacion,
      fechaInicio: reserva.fecha_inicio,
      fechaFin: reserva.fecha_fin,
    });

    // 6) Total factura (por ahora: solo alojamiento)
    const totalFactura = Number(totalAlojamiento);

    // 7) Crear factura
    const insF = await client.query(
      `
      INSERT INTO facturas (reserva_id, numero, fecha_emision, total, estado, created_at, updated_at)
      VALUES ($1, $2, NOW(), $3, 'emitida', NOW(), NOW())
      RETURNING id, reserva_id, numero, fecha_emision, total, estado
      `,
      [reservaId, `F-${dayjs().format("YYYYMMDD")}-${reservaId}`, totalFactura]
    );
    const factura = insF.rows[0];

    // 8) Insertar detalle: alojamiento
    const nochesFact = Math.max(Number(noches || 0), 1);
    const valorUnitarioProm = nochesFact > 0 ? totalAlojamiento / nochesFact : totalAlojamiento;

    await client.query(
      `
      INSERT INTO factura_detalle (factura_id, descripcion, cantidad, valor_unitario, valor_total)
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        factura.id,
        `Alojamiento Hab. ${reserva.habitacion_numero} (${tipoHabitacion}) - Plan ${plan}`,
        nochesFact,
        valorUnitarioProm,
        totalAlojamiento,
      ]
    );

    // 9) Marcar reserva facturada + snapshot
    await client.query(
      `
      UPDATE reservas
      SET facturada = true,
          tarifa_snapshot = $2,
          updated_at = NOW()
      WHERE id = $1
      `,
      [reservaId, totalAlojamiento]
    );

    await client.query("COMMIT");
    return res.status(201).json({ factura });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("facturarReserva error:", e);
    return res.status(500).json({ message: e.message || "Error al generar la factura." });
  } finally {
    client.release();
  }
};

/**
 * GET /api/facturacion/facturas/:id
 * Detalle completo de la factura (cabecera + detalle) para "Ver / reimprimir".
 */
export const obtenerFactura = async (req, res) => {
  const { id } = req.params;

  try {
    const qCab = `
      SELECT
        f.id,
        f.reserva_id,
        f.fecha_emision,
        f.total,
        f.estado,
        r.fecha_inicio,
        r.fecha_fin,
        h.numero AS habitacion_numero,
        h.tipo   AS habitacion_tipo,
        COALESCE(hu.nombre, '') AS huesped_nombre
      FROM facturas f
      JOIN reservas r       ON r.id = f.reserva_id
      JOIN habitaciones h   ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE f.id = $1
      LIMIT 1
    `;
    const { rows: cabRows } = await pool.query(qCab, [id]);
    if (!cabRows.length) {
      return res.status(404).json({ message: "Factura no encontrada." });
    }
    const factura = cabRows[0];

    const qDet = `
      SELECT *
      FROM factura_detalle
      WHERE factura_id = $1
      ORDER BY id
    `;
    const { rows: detRows } = await pool.query(qDet, [id]);

    factura.detalle = detRows;
    res.json(factura);
  } catch (e) {
    console.error("obtenerFactura error:", e);
    res.status(500).json({ message: "Error al obtener la factura." });
  }
};

/**
 * GET /api/facturacion/pagos
 * Listado de pagos/depositos/cargos — filtra por ?desde, ?hasta, ?metodo, ?tipo
 */
export const listarPagos = async (req, res) => {
  const { desde, hasta, metodo, tipo } = req.query;
  const params = [];
  const conds = ["1=1"];

  if (desde) { params.push(desde); conds.push(`p.created_at::date >= $${params.length}::date`); }
  if (hasta) { params.push(hasta); conds.push(`p.created_at::date <= $${params.length}::date`); }
  if (metodo) { params.push(metodo); conds.push(`p.metodo = $${params.length}`); }
  if (tipo)   { params.push(tipo);   conds.push(`p.tipo   = $${params.length}`); }

  try {
    const { rows } = await pool.query(`
      SELECT
        p.id, p.reserva_id, p.tipo, p.metodo, p.monto, p.referencia,
        p.created_at,
        r.fecha_inicio, r.fecha_fin,
        h.numero AS habitacion_numero, h.tipo AS habitacion_tipo,
        COALESCE(
          NULLIF(TRIM(CONCAT_WS(' ', hu.nombres, hu.primer_apellido, hu.segundo_apellido)),''),
          NULLIF(TRIM(hu.nombre),''), ''
        ) AS huesped_nombre
      FROM pagos p
      JOIN reservas r       ON r.id = p.reserva_id
      JOIN habitaciones h   ON h.id = r.habitacion_id
      LEFT JOIN huespedes hu ON hu.id = r.huesped_id
      WHERE ${conds.join(" AND ")}
      ORDER BY p.created_at DESC
      LIMIT 500
    `, params);

    res.json(rows);
  } catch (e) {
    console.error("listarPagos error:", e);
    res.status(500).json({ message: "Error al listar pagos." });
  }
};

/**
 * PUT /api/facturacion/facturas/:id/anular
 * Anula una factura emitida y reactiva la posibilidad de facturar de nuevo
 */
export const anularFactura = async (req, res) => {
  const { id } = req.params;
  const { motivo } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const fq = await client.query(
      `SELECT id, estado, reserva_id FROM facturas WHERE id = $1 LIMIT 1`, [id]
    );
    if (!fq.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Factura no encontrada." });
    }
    const f = fq.rows[0];
    if (f.estado === "anulada") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "La factura ya está anulada." });
    }
    await client.query(
      `UPDATE facturas SET estado='anulada', updated_at=NOW() WHERE id=$1`, [id]
    );
    // Revertir marca facturada en la reserva para poder volver a facturar
    await client.query(
      `UPDATE reservas SET facturada=false, updated_at=NOW() WHERE id=$1`, [f.reserva_id]
    );
    // Registrar en auditoría si hay tabla
    await client.query(
      `INSERT INTO auditoria (accion, tabla, registro_id, detalle, created_at)
       VALUES ('anular_factura', 'facturas', $1, $2, NOW())
       ON CONFLICT DO NOTHING`,
      [id, motivo ? `Motivo: ${motivo}` : "Anulada por administrador"]
    ).catch(() => {}); // no falla si no existe tabla auditoria

    await client.query("COMMIT");
    return res.json({ message: "Factura anulada correctamente." });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("anularFactura error:", e);
    return res.status(500).json({ message: "Error al anular la factura." });
  } finally {
    client.release();
  }
};


/**
 * POST /api/reservas/:id/pagos
 * Crea un pago/deposito/cargo asociado a una reserva
 */
// POST /api/reservas/:id/pagos
/**
 * DELETE /api/reservas/:id/pagos/:pagoId
 * Elimina un pago/depósito siempre que la reserva no tenga factura emitida.
 */
export const eliminarPago = async (req, res) => {
  const reservaId = Number(req.params.id);
  const pagoId    = Number(req.params.pagoId);

  if (!reservaId || !pagoId) {
    return res.status(400).json({ message: "Parámetros inválidos." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Verificar que no existe factura emitida para esta reserva
    const fRes = await client.query(
      `SELECT id FROM facturas WHERE reserva_id = $1 AND estado = 'emitida' LIMIT 1`,
      [reservaId]
    );
    if (fRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "No se puede eliminar el pago: ya existe una factura emitida para esta reserva.",
      });
    }

    // Verificar que el pago pertenece a esta reserva
    const pRes = await client.query(
      `SELECT id, tipo FROM pagos WHERE id = $1 AND reserva_id = $2`,
      [pagoId, reservaId]
    );
    if (!pRes.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Pago no encontrado en esta reserva." });
    }

    await client.query(`DELETE FROM pagos WHERE id = $1`, [pagoId]);

    await client.query("COMMIT");
    return res.json({ message: "Pago eliminado correctamente." });
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("eliminarPago error:", e);
    return res.status(500).json({ message: "Error al eliminar el pago." });
  } finally {
    client.release();
  }
};

export const registrarPago = async (req, res) => {
  const { id } = req.params;
  const { monto, metodo, tipo, descripcion, referencia, fecha } = req.body;

  if (!monto || !metodo || !tipo) {
    return res.status(400).json({ message: "Datos incompletos para el pago." });
  }

  try {
    const ins = await pool.query(
      `
      INSERT INTO pagos
        (reserva_id, fecha, monto, metodo, tipo, referencia)
      VALUES
        ($1, COALESCE($2::date, NOW()::date), $3, $4, $5, $6)
      RETURNING *
    `,
      [
        id,
        fecha || null,
        monto,
        metodo,
        tipo,
        (referencia || descripcion || null),
      ]
    );

    res.status(201).json(ins.rows[0]);
  } catch (e) {
    console.error("registrarPago error:", e);
    res.status(500).json({ message: "Error al registrar el pago." });
  }
};


