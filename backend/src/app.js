import express from "express";
import dotenv from "dotenv";
import cors from "cors";

import hotelRoutes          from "./routes/hotel.routes.js";
import huespedesRoutes      from "./routes/huespedes.routes.js";
import habitacionesRoutes   from "./routes/habitaciones.routes.js";
import reservasRoutes       from "./routes/reservas.routes.js";
import serviciosroutes      from "./routes/servicios.routes.js";
import authRoutes           from "./routes/auth.routes.js";
import pagosRoutes          from "./routes/pagos.routes.js";
import facturacionRoutes    from "./routes/facturacion.routes.js";
import bloqueosRoutes       from "./routes/bloqueos.routes.js";
import cargosRoutes         from "./routes/cargos.routes.js";
import auditoriaRoutes      from "./routes/auditoria.routes.js";
import tiposHabitacionRoutes from "./routes/tiposHabitacion.routes.js";
import usuariosRoutes       from "./routes/usuarios.routes.js";
import otasRoutes           from "./routes/otas.routes.js";
import tarifasRoutes        from "./routes/tarifas.routes.js"; 

dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:3000",
  methods: "GET,POST,PUT,DELETE",
  credentials: true,
}));

app.use(express.json());

// Rutas 
app.use("/api",                  hotelRoutes);
app.use("/api/config",           hotelRoutes);          
app.use("/api/huespedes",        huespedesRoutes);
app.use("/api/habitaciones",     habitacionesRoutes);
app.use("/api/reservas",         reservasRoutes);
app.use("/api/servicios-consumidos", serviciosroutes);
app.use("/api/auth",             authRoutes);
app.use("/api/pagos",            pagosRoutes);
app.use("/api/facturacion",      facturacionRoutes);
app.use("/api/bloqueos",         bloqueosRoutes);
app.use("/api/cargos",           cargosRoutes);
app.use("/api/auditoria",        auditoriaRoutes);
app.use("/api/tipos-habitacion", tiposHabitacionRoutes);
app.use("/api/usuarios",         usuariosRoutes);
app.use("/api/otas",             otasRoutes);
app.use("/api/tarifas",          tarifasRoutes);        

export default app;