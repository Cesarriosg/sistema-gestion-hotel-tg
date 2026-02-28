import request from "supertest";
import app from "../app.js";
import { pool } from "../config/database.js";
import dayjs from "dayjs";

describe("Reservas - Check-in", () => {
  let habitacionId;
  let reservaId;
  const habNumero = "101"; // ajusta si 101 no existe

  beforeAll(async () => {
    // 1) buscar habitación real
    const hab = await pool.query(
      "SELECT id, numero FROM habitaciones WHERE trim(numero)=trim($1) LIMIT 1",
      [habNumero]
    );
    if (!hab.rows.length) {
      throw new Error(`No existe habitación ${habNumero} para pruebas`);
    }
    habitacionId = hab.rows[0].id;

    // 2) configurar fecha_sistema dentro del rango
    const hoy = dayjs().format("YYYY-MM-DD");
    await pool.query("UPDATE configuracion SET fecha_sistema = $1", [hoy]);

    // 3) crear una reserva reservada que incluya hoy
    const desde = hoy;
    const hasta = dayjs(hoy).add(2, "day").format("YYYY-MM-DD");

    const ins = await pool.query(
      `INSERT INTO reservas (fecha_inicio, fecha_fin, estado, habitacion_id, created_at, updated_at)
       VALUES ($1,$2,'reservada',$3,NOW(),NOW())
       RETURNING id`,
      [desde, hasta, habitacionId]
    );
    reservaId = ins.rows[0].id;

    // 4) dejar habitación en reservada (coherencia)
    await pool.query(
      `UPDATE habitaciones SET estado='reservada', updated_at=NOW() WHERE id=$1`,
      [habitacionId]
    );
  });

  test("Debe fallar si NO envían tipo_documento y documento del titular", async () => {
    const res = await request(app)
      .post(`/api/reservas/${reservaId}/checkin`)
      .send({ titular: { nombres: "Cesar" } });

    expect(res.statusCode).toBe(400);
    expect(res.body?.message).toMatch(/check-in/i);
  });

  test("Debe hacer check-in y cambiar reserva/habitación a 'ocupada' + crear titular en BD", async () => {
    const res = await request(app)
      .post(`/api/reservas/${reservaId}/checkin`)
      .send({
        titular: {
          tipo_documento: "CC",
          documento: "99999999",
          nombres: "Cesar",
          primer_apellido: "Rios",
          segundo_apellido: "Gonzalez",
          telefono: "3000000000",
          email: "cesar.test@hotel.com",
        },
        acompanantes: [
          {
            tipo_documento: "CC",
            documento: "88888888",
            nombres: "Juan",
            primer_apellido: "Perez",
          },
        ],
      });

    expect(res.statusCode).toBe(200);
    expect(res.body?.estado).toBe("ocupada");

    // verificar habitación ocupada
    const h = await pool.query("SELECT estado FROM habitaciones WHERE id=$1", [habitacionId]);
    expect(h.rows[0].estado).toBe("ocupada");

    // verificar pivote titular y acompañante
    const piv = await pool.query(
      `SELECT rol FROM reserva_huespedes WHERE reserva_id=$1 ORDER BY rol`,
      [reservaId]
    );
    const roles = piv.rows.map(r => r.rol);
    expect(roles).toContain("titular");
    expect(roles).toContain("acompanante");
  });

  test("Debe fallar si la habitación está en mantenimiento", async () => {
    // crear otra reserva reservada
    const hoy = dayjs().format("YYYY-MM-DD");
    const hasta = dayjs(hoy).add(2, "day").format("YYYY-MM-DD");
    const ins = await pool.query(
      `INSERT INTO reservas (fecha_inicio, fecha_fin, estado, habitacion_id, created_at, updated_at)
       VALUES ($1,$2,'reservada',$3,NOW(),NOW())
       RETURNING id`,
      [hoy, hasta, habitacionId]
    );
    const id2 = ins.rows[0].id;

    await pool.query(`UPDATE habitaciones SET estado='mantenimiento' WHERE id=$1`, [habitacionId]);

    const res = await request(app)
      .post(`/api/reservas/${id2}/checkin`)
      .send({
        titular: { tipo_documento: "CC", documento: "77777777", nombres: "Test" },
      });

    expect(res.statusCode).toBe(400);
    expect(res.body?.message).toMatch(/mantenimiento/i);

    // devuelve habitación a reservada/operable para no dañar otros tests
    await pool.query(`UPDATE habitaciones SET estado='reservada' WHERE id=$1`, [habitacionId]);
  });
});
