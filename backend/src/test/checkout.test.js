import request from "supertest";
import app from "../app.js";
import { pool } from "../config/database.js";
import dayjs from "dayjs";

describe("Reservas - Check-out", () => {
  let habitacionId;
  let reservaId;

  beforeAll(async () => {
    // habitación real
    const hab = await pool.query(
      "SELECT id FROM habitaciones WHERE trim(numero)=trim($1) LIMIT 1",
      ["101"] // ajusta
    );
    if (!hab.rows.length) throw new Error("No existe hab 101");
    habitacionId = hab.rows[0].id;

    const llegada = dayjs().subtract(2, "day").format("YYYY-MM-DD");
    const salida = dayjs().add(1, "day").format("YYYY-MM-DD");

    // fecha_sistema: hoy (>= llegada + 1)
    await pool.query("UPDATE configuracion SET fecha_sistema = $1", [dayjs().format("YYYY-MM-DD")]);

    // reserva ocupada
    const ins = await pool.query(
      `INSERT INTO reservas (fecha_inicio, fecha_fin, estado, habitacion_id, checkin_at, created_at, updated_at)
       VALUES ($1,$2,'ocupada',$3,NOW(),NOW(),NOW())
       RETURNING id`,
      [llegada, salida, habitacionId]
    );
    reservaId = ins.rows[0].id;

    await pool.query(`UPDATE habitaciones SET estado='ocupada' WHERE id=$1`, [habitacionId]);

  
    await pool.query(
      `INSERT INTO facturas (numero, reserva_id, fecha_emision,total, estado, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'emitida',NOW(),NOW())`,
      [`F-TEST-${reservaId}`, reservaId, new Date(),0]
    );
  });

  test("Debe hacer checkout y dejar habitación disponible", async () => {
    const res = await request(app).post(`/api/reservas/${reservaId}/checkout`).send({});
    expect(res.statusCode).toBe(200);
    expect(res.body?.estado).toBe("finalizada");

    const h = await pool.query("SELECT estado FROM habitaciones WHERE id=$1", [habitacionId]);
    expect(h.rows[0].estado).toBe("disponible");
  });

  test("Debe fallar si no existe factura", async () => {
    // crear reserva ocupada SIN factura
    const llegada = dayjs().subtract(2, "day").format("YYYY-MM-DD");
    const salida = dayjs().add(1, "day").format("YYYY-MM-DD");

    const ins = await pool.query(
      `INSERT INTO reservas (fecha_inicio, fecha_fin, estado, habitacion_id, checkin_at, created_at, updated_at)
       VALUES ($1,$2,'ocupada',$3,NOW(),NOW(),NOW())
       RETURNING id`,
      [llegada, salida, habitacionId]
    );
    const id2 = ins.rows[0].id;

    const res = await request(app).post(`/api/reservas/${id2}/checkout`).send({});
    expect(res.statusCode).toBe(400);
    expect(res.body?.message).toMatch(/factura/i);
  });
});
