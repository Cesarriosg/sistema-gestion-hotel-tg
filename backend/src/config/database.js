import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

export const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "hotel",
  password: process.env.DB_PASSWORD || "123456",
  port: process.env.DB_PORT || 5432,
});

export default pool;

pool
  .query("SELECT NOW()")
  .then((r) => console.log(" Conectado a PostgreSQL:", r.rows[0].now))
  .catch((e) => console.error("❌ Error al conectar a PostgreSQL:", e.message));

