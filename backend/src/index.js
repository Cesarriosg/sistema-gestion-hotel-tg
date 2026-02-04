import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import http from "http";
import { Server as SocketIOServer } from "socket.io";

// Rutas
import hotelRoutes from "./routes/hotel.routes.js";
import huespedesRoutes from "./routes/huespedes.routes.js";
import habitacionesRoutes from "./routes/habitaciones.routes.js";
import reservasRoutes from "./routes/reservas.routes.js";
import serviciosroutes from "./routes/servicios.routes.js";
import authRoutes from "./routes/auth.routes.js";
import configRoutes from "./routes/config.routes.js";
import pagosRoutes from "./routes/pagos.routes.js";
import facturacionRoutes from "./routes/facturacion.routes.js";
import bloqueosRoutes from "./routes/bloqueos.routes.js";
import cargosRoutes from "./routes/cargos.routes.js";
import auditoriaRoutes from "./routes/auditoria.routes.js";
import tiposHabitacionRoutes from "./routes/tiposHabitacion.routes.js";
import usuariosRoutes from "./routes/usuarios.routes.js";
import otasRoutes from "./routes/otas.routes.js";

dotenv.config();

// ✅ 1. Crear app primero
const app = express();

// ✅ 2. Middlewares
app.use(cors({
  origin: "http://localhost:3000",
  methods: ["GET","POST","PUT","DELETE"],
  credentials: true
}));

app.use(express.json());

// ✅ 3. Crear servidor HTTP
const server = http.createServer(app);

// ✅ 4. Socket.IO
const io = new SocketIOServer(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET","POST","PUT","DELETE"],
    credentials: true,
  },
});

// Hacer io accesible desde controllers
app.set("io", io);

io.on("connection", (socket) => {
  console.log("🟢 Socket conectado:", socket.id);
  socket.on("disconnect", () =>
    console.log("🔴 Socket desconectado:", socket.id)
  );
});

// ✅ 5. Rutas
app.use("/api", hotelRoutes);
app.use("/api/huespedes", huespedesRoutes);
app.use("/api/habitaciones", habitacionesRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/servicios-consumidos", serviciosroutes);
app.use("/api/auth", authRoutes);
app.use("/api/config", configRoutes);
app.use("/api/pagos", pagosRoutes);
app.use("/api/facturacion", facturacionRoutes);
app.use("/api/bloqueos", bloqueosRoutes);
app.use("/api/cargos", cargosRoutes);
app.use("/api/auditoria", auditoriaRoutes);
app.use("/api/tipos-habitacion", tiposHabitacionRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/otas", otasRoutes);

// ✅ 6. Escuchar con server (NO app.listen)
const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});

console.log("CHANNEX_API_KEY length:", (process.env.CHANNEX_API_KEY || "").trim().length);

