import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import { verificarToken, soloAdmin } from "../middlewares/authMiddleware.js";

describe("Seguridad - Middlewares", () => {
  test("verificarToken: rechaza sin token", () => {
    const req = { headers: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  test("verificarToken: acepta token válido", () => {
    const token = jwt.sign({ id: 1, rol: "admin" }, process.env.JWT_SECRET || "secret_key");
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    verificarToken(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.usuario.rol).toBe("admin");
  });

  test("soloAdmin: rechaza si rol != admin", () => {
    const req = { usuario: { rol: "recepcionista" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    soloAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});
