import request from "supertest";
import app from "../app.js";
import { pool } from "../config/database.js";
import dayjs from "dayjs";

describe("Pagos", () => {
  let habId;
  let reservaReservada;
  let reservaOcupada;

  beforeAll(async () => {
    const hab = await pool.query("SELECT id FROM habitaciones WHERE trim(numero)=trim($1) LIMIT 1", ["101"]);
    habId = hab.rows[0].id;

    const d = dayjs().format("YYYY-MM-DD");
    const h = dayjs().add(2, "day").format("YYYY-MM-DD");

    const r1 = await pool.query(
      `INSERT INTO reservas (fecha_inicio, fecha_fin, estado, habitacion_id, created_at, updated_at)
       VALUES ($1,$2,'reservada',$3,NOW(),NOW()) RETURNING id`,
      [d, h, habId]
    );
    reservaReservada = r1.rows[0].id;

    const r2 = await pool.query(
      `INSERT INTO reservas (fecha_inicio, fecha_fin, estado, habitacion_id, checkin_at, created_at, updated_at)
       VALUES ($1,$2,'ocupada',$3,NOW(),NOW(),NOW()) RETURNING id`,
      [d, h, habId]
    );
    reservaOcupada = r2.rows[0].id;
  });

  test("Debe permitir depósito solo en reservada", async () => {
    const res = await request(app)
      .post(`/api/reservas/${reservaReservada}/pagos`)
      .send({ reserva_id: reservaReservada, tipo: "deposito", metodo: "efectivo", monto: 50000 });

    expect([200, 201]).toContain(res.statusCode);
  });

  test("Debe RECHAZAR depósito si reserva está ocupada", async () => {
    const res = await request(app)
      .post(`/api/reservas/${reservaOcupada}/pagos`)
      .send({ reserva_id: reservaOcupada, tipo: "deposito", metodo: "efectivo", monto: 50000 });

    expect(res.statusCode).toBe(400);
    expect(res.body?.message).toMatch(/depósitos/i);
  });

  test("Debe permitir pago solo en ocupada", async () => {
    const res = await request(app)
      .post(`/api/reservas/${reservaOcupada}/pagos`)
      .send({ reserva_id: reservaOcupada, tipo: "pago", metodo: "tarjeta", monto: 120000 });

    expect([200, 201]).toContain(res.statusCode);
  });

  test("Debe RECHAZAR pago si reserva está reservada", async () => {
    const res = await request(app)
      .post(`/api/reservas/${reservaReservada}/pagos`)
      .send({ reserva_id: reservaReservada, tipo: "pago", metodo: "tarjeta", monto: 120000 });

    expect(res.statusCode).toBe(400);
    expect(res.body?.message).toMatch(/pagos/i);
  });
});
