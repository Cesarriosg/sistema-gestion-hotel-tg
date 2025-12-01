import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { pool } from "./config/database.js"; 
import hotelRoutes from "./routes/hotel.routes.js";        // /api/test
import huespedesRoutes from "./routes/huespedes.routes.js";// /api/huespedes
import habitacionesRoutes from "./routes/habitaciones.routes.js";// /api/habitaciones
import reservasRoutes from "./routes/reservas.routes.js";  // /api/reservas
import serviciosroutes from "./routes/servicios.routes.js";
import authRoutes from "./routes/auth.routes.js";
import configRoutes from "./routes/config.routes.js";


dotenv.config();

const app = express();

app.use(cors({
  origin: "http://localhost:3000", // Permite tu frontend
  methods: "GET,POST,PUT,DELETE",
  credentials: true
}));

app.use(express.json());

// ✅ Prefijo para todas las rutas
app.use("/api", hotelRoutes);
app.use("/api/huespedes", huespedesRoutes);
app.use("/api/habitaciones", habitacionesRoutes);
app.use("/api/reservas", reservasRoutes);
app.use("/api/servicios-consumidos", serviciosroutes);
app.use("/api/auth", authRoutes);
app.use("/api/config", configRoutes);


const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
