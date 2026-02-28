import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../app.js";

describe("Habitaciones - Disponibilidad", () => {
  const token = jwt.sign(
    { id: 1, rol: "admin" },
    process.env.JWT_SECRET || "secret_key",
    { expiresIn: "1h" }
  );

  test("Debe devolver 400 si no envían desde/hasta", async () => {
    const res = await request(app)
      .get("/api/habitaciones/disponibles")
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(400);
  });

  test("Debe excluir habitaciones con choque de reserva", async () => {
    const desde = "2026-02-10";
    const hasta = "2026-02-12";

    const res = await request(app)
      .get(`/api/habitaciones/disponibles?desde=${desde}&hasta=${hasta}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    // luego validas que NO venga la 101 si ya la ocupaste en el setup
  });
});
