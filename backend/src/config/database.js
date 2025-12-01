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

// ✅ Probar conexión al iniciar
try {
  await pool.connect();
  console.log("✅ Conectado a la base de datos PostgreSQL");
} catch (error) {
  console.error("❌ Error al conectar a la base de datos:", error.message);
}

export default pool;
