import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";
import { pool } from "./config/database.js";

// Rutas
import hotelRoutes from "./routes/hotel.routes.js";
import huespedesRoutes from "./routes/huespedes.routes.js";
import habitacionesRoutes from "./routes/habitaciones.routes.js";
import reservasRoutes from "./routes/reservas.routes.js";
import serviciosConsumidosRoutes from "./routes/servicios_consumidos.routes.js";
import serviciosRoutes           from "./routes/servicios.routes.js";
import authRoutes from "./routes/auth.routes.js";
import configRoutes from "./routes/config.routes.js";
import pagosRoutes from "./routes/pagos.routes.js";
import facturacionRoutes from "./routes/facturacion.routes.js";
import bloqueosRoutes from "./routes/bloqueos.routes.js";
import cargosRoutes from "./routes/cargos.routes.js";
import auditoriaRoutes from "./routes/auditoria.routes.js";
import tiposHabitacionRoutes from "./routes/tiposHabitacion.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import otasRoutes      from "./routes/otas.routes.js";
import reportesRoutes  from "./routes/reportes.routes.js";
import tarifasRoutes   from "./routes/tarifas.routes.js";
import planesRoutes       from "./routes/planes.routes.js";
import promocionesRoutes  from "./routes/promociones.routes.js";

dotenv.config();


const app = express();

// Middlewares
const allowedOrigins = [
  "http://localhost:3000",
  "https://hoteltg26.vercel.app",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("/{*path}", cors(corsOptions)); // preflight para todas las rutas

app.use(express.json());

//  Crear servidor HTTP
const server = http.createServer(app);

//  Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

// Hacer io accesible desde controllers
app.set("io", io);


// ── Notificaciones internas RF-03 ─────────────────────────────────────────
const _notifs = [];
app.set("emitNotificacion", (tipo, titulo, mensaje, datos = {}) => {
  const n = { id: Date.now(), tipo, titulo, mensaje, datos, leida: false, created_at: new Date().toISOString() };
  _notifs.unshift(n);
  if (_notifs.length > 50) _notifs.pop();
  io.emit("notificacion", n);
});
app.get("/api/notificaciones", (_req, res) => res.json(_notifs.slice(0, 30)));
app.put("/api/notificaciones/leer", (_req, res) => {
  _notifs.forEach(n => { n.leida = true; });
  res.json({ ok: true });
});

io.on("connection", (socket) => {
  console.log("🟢 Socket conectado:", socket.id);
  socket.on("disconnect", () =>
    console.log("🔴 Socket desconectado:", socket.id)
  );
});

// Rutas
app.use("/api", hotelRoutes);
app.use("/api/huespedes", huespedesRoutes);
app.use("/api/habitaciones", habitacionesRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/servicios-consumidos", serviciosConsumidosRoutes);
app.use("/api/servicios",           serviciosRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/config", configRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/facturacion", facturacionRoutes);
app.use("/api/bloqueos", bloqueosRoutes);
app.use("/api/cargos", cargosRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/tipos-habitacion", tiposHabitacionRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/otas",      otasRoutes);
app.use("/api/reportes", reportesRoutes);
app.use("/api/tarifas",  tarifasRoutes);
app.use("/api/planes",      planesRoutes);
app.use("/api/promociones", promocionesRoutes);

const PORT = process.env.PORT || 4000;

// Migración: ampliar CHECK constraint de pagos para incluir 'descuento'
(async () => {
  try {
    const client = await pool.connect();
    try {
      await client.query("ALTER TABLE pagos DROP CONSTRAINT IF EXISTS pagos_tipo_check");
      await client.query(`
        ALTER TABLE pagos
        ADD CONSTRAINT pagos_tipo_check
        CHECK (tipo IN ('pago', 'deposito', 'cargo', 'descuento'))
      `);
      console.log("✅ Migración pagos_tipo_check: 'descuento' habilitado.");
    } catch (e) {
      console.error("⚠️  Migración pagos_tipo_check falló:", e.message);
    } finally {
      client.release();
    }
  } catch (e) {
    console.error("⚠️  No se pudo conectar para migración (DB no disponible):", e.message);
  }
})();

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

console.log("CHANNEX_API_KEY length:", (process.env.CHANNEX_API_KEY || "").trim().length);