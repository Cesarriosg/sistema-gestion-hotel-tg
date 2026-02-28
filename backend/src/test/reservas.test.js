import request from "supertest";
import app from "../app.js";
import { pool } from "../config/database.js";
import dayjs from "dayjs";

describe("Reservas - API", () => {
  let habitacionNumero;
  let reservaIdCreada;

  beforeAll(async () => {
    // 1) escoger una habitación operativa
    const h = await pool.query(`
      SELECT numero
      FROM habitaciones
      WHERE estado NOT IN ('mantenimiento','fuera_servicio')
      ORDER BY numero ASC
      LIMIT 1
    `);

    if (!h.rows.length) {
      throw new Error("No hay habitaciones operativas para correr pruebas.");
    }

    habitacionNumero = String(h.rows[0].numero).trim();
  });

  afterAll(async () => {
    // limpiar la reserva que creamos (si existe)
    if (reservaIdCreada) {
      await pool.query("DELETE FROM reservas WHERE id=$1", [reservaIdCreada]);
    }
  });

  test("Debe rechazar reserva con fechas inválidas", async () => {
    const res = await request(app)
      .post("/api/reservas")
      .send({
        tipo: "reserva",
        habitacion_numero: habitacionNumero,
        fecha_inicio: "2026-02-10",
        fecha_fin: "2026-02-09",
      });

    expect([400, 422]).toContain(res.statusCode);
  });

  test("Debe crear una reserva válida", async () => {
    // fechas futuras para minimizar choques
    const desde = dayjs().add(15, "day").format("YYYY-MM-DD");
    const hasta = dayjs(desde).add(1, "day").format("YYYY-MM-DD");

    const res = await request(app)
      .post("/api/reservas")
      .send({
        tipo: "reserva",
        habitacion_numero: habitacionNumero,
        fecha_inicio: desde,
        fecha_fin: hasta,
        huesped_nombre: "HUÉSPED TEST",
        notas: "Test reserva",
        plan: "C1",
      });

    expect([200, 201]).toContain(res.statusCode);
    expect(res.body?.id).toBeTruthy();

    reservaIdCreada = res.body.id;
  });

  test("Debe detectar choque si ya existe reserva en el rango", async () => {
    const desde = dayjs().add(25, "day").format("YYYY-MM-DD");
    const hasta = dayjs(desde).add(1, "day").format("YYYY-MM-DD");

    // 1) crear base
    const base = await request(app)
      .post("/api/reservas")
      .send({
        tipo: "reserva",
        habitacion_numero: habitacionNumero,
        fecha_inicio: desde,
        fecha_fin: hasta,
        huesped_nombre: "BASE TEST",
        plan: "C1",
      });

    expect([200, 201]).toContain(base.statusCode);
    const baseId = base.body?.id;

    // 2) intentar solapar mismo rango
    const choque = await request(app)
      .post("/api/reservas")
      .send({
        tipo: "reserva",
        habitacion_numero: habitacionNumero,
        fecha_inicio: desde,
        fecha_fin: hasta,
        huesped_nombre: "CHOQUE TEST",
        plan: "C1",
      });

    expect([409, 400]).toContain(choque.statusCode);

    // limpiar base
    if (baseId) {
      await pool.query("DELETE FROM reservas WHERE id=$1", [baseId]);
    }
  });
});
