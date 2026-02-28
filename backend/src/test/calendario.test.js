import request from "supertest";
import app from "../app.js";

describe("Calendario/Rack", () => {
  test("Debe devolver reservas para calendario", async () => {
    const res = await request(app).get("/api/reservas/calendario");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});