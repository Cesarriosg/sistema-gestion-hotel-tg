import { jest } from "@jest/globals";
import request from "supertest";

// Mock ESM de axios
jest.unstable_mockModule("axios", () => ({
  default: {
    get: jest.fn(),
  },
}));

const axios = (await import("axios")).default;
const app = (await import("../app.js")).default;

describe("OTA - Webhook Channex", () => {
  test("Debe responder 200 y no caerse si axios da Unauthorized", async () => {
    axios.get.mockRejectedValueOnce(new Error("Unauthorized"));

    const res = await request(app)
      .post("/api/otas/channex/webhook")
      .send({ booking_revision_id: "fake-id" });

    expect(res.statusCode).toBe(200);
    expect(res.body).toBeDefined();
  });
});
