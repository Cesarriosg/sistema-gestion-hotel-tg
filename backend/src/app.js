
import express from "express";
import dotenv from "dotenv";
import cors from "cors";


import hotelRoutes           from "./routes/hotel.routes.js";
import huespedesRoutes       from "./routes/huespedes.routes.js";
import habitacionesRoutes    from "./routes/habitaciones.routes.js";
import reservasRoutes        from "./routes/reservas.routes.js";
import serviciosRoutes       from "./routes/servicios.routes.js";
import authRoutes            from "./routes/auth.routes.js";
import configRoutes          from "./routes/config.routes.js";
import pagosRoutes           from "./routes/pagos.routes.js";
import facturacionRoutes     from "./routes/facturacion.routes.js";
import bloqueosRoutes        from "./routes/bloqueos.routes.js";
import cargosRoutes          from "./routes/cargos.routes.js";
import auditoriaRoutes       from "./routes/auditoria.routes.js";
import tiposHabitacionRoutes from "./routes/tiposHabitacion.routes.js";
import usuariosRoutes        from "./routes/usuarios.routes.js";
import otasRoutes            from "./routes/otas.routes.js";

import tarifasRoutes         from "./routes/tarifas.routes.js";
import planesRoutes          from "./routes/planes.routes.js";
import reportesRoutes        from "./routes/reportes.routes.js";

dotenv.config();

const app = express();

const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // preflight para todas las rutas

app.use(express.json());

// ── Rutas ─────────────────────────────────────────────────────────────────────
app.use("/api",                      hotelRoutes);        // /api/test, /api/dashboard, /api/fecha-sistema
app.use("/api/config",               configRoutes);       // /api/config/fecha-sistema (compatibilidad)
app.use("/api/huespedes",            huespedesRoutes);
app.use("/api/habitaciones",         habitacionesRoutes);
app.use("/api/reservas",             reservasRoutes);
app.use("/api/servicios-consumidos", serviciosRoutes);
app.use("/api/auth",                 authRoutes);
app.use("/api/pagos",                pagosRoutes);
app.use("/api/facturacion",          facturacionRoutes);
app.use("/api/bloqueos",             bloqueosRoutes);
app.use("/api/cargos",               cargosRoutes);
app.use("/api/auditoria",            auditoriaRoutes);
app.use("/api/tipos-habitacion",     tiposHabitacionRoutes);
app.use("/api/usuarios",             usuariosRoutes);
app.use("/api/otas",                 otasRoutes);
app.use("/api/tarifas",              tarifasRoutes);
app.use("/api/planes",               planesRoutes);
app.use("/api/reportes",             reportesRoutes); 

export default app;