import request from "supertest";
import app from "../app.js";
import { pool } from "../config/database.js";
import bcrypt from "bcrypt";

describe("Auth - Login", () => {
  const emailOK = "admin.test@hotel.com";
  const passOK = "admin123*";

  beforeAll(async () => {
    // borrar por si existe
    await pool.query('DELETE FROM usuarios WHERE email=$1', [emailOK]);

    const hash = await bcrypt.hash(passOK, 10);

    // crear usuario de prueba con las columnas reales
    await pool.query(
      `
      INSERT INTO usuarios (nombre, email, password, rol, estado, "createdAt", "updatedAt")
      VALUES ($1,$2,$3,$4,$5,NOW(),NOW())
      `,
      ["Admin Test", emailOK, hash, "admin", true]
    );
  });

  afterAll(async () => {
    // limpiar (NO cierres pool aquí)
    await pool.query("DELETE FROM usuarios WHERE email=$1", [emailOK]);
  });

  test("Debe fallar si usuario no existe", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "noexiste@hotel.com", password: "x" });

    expect(res.statusCode).toBe(404);
    expect(res.body?.error).toBeTruthy();
  });

  test("Debe fallar si contraseña incorrecta", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: emailOK, password: "MalaClave" });

    expect(res.statusCode).toBe(401);
    expect(res.body?.error).toBeTruthy();
  });

  test("Debe loguear y devolver token", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: emailOK, password: passOK });

    expect(res.statusCode).toBe(200);
    expect(res.body?.token).toBeTruthy();
    expect(res.body?.rol).toBe("admin");
  });
});
