import { pool } from "../config/database.js";

// evita cerrar el pool más de una vez
if (!global.__POOL_CLOSED__) global.__POOL_CLOSED__ = false;

afterAll(async () => {
  if (!global.__POOL_CLOSED__) {
    global.__POOL_CLOSED__ = true;
    await pool.end();
  }
});
