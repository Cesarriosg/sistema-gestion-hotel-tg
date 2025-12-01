// src/App.js
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Panel from "./pages/Panel";
import MainLayout from "./layouts/MainLayout";
import PrivateRoute from "./routes/PrivateRoute";

import CalendarioReservas from "./pages/CalendarioReservas";
import CalendarioRack from "./pages/CalendarioRack";
import CheckIn from "./pages/CheckIn";
import NuevaReserva from "./pages/NuevaReserva";
import NuevoWalkIn from "./pages/NuevoWalkIn";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* RUTAS PÚBLICAS */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* RACK / CALENDARIO = PANTALLA PRINCIPAL LUEGO DE LOGIN */}
        <Route
          path="/calendario"
          element={
            <PrivateRoute>
              <MainLayout>
                <CalendarioRack />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* PANEL ADMIN (ejemplo de ruta solo admin) */}
        <Route
          path="/panel"
          element={
            <PrivateRoute roles={["admin"]}>
              <MainLayout>
                <Panel />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* RESERVAS (lista o calendario de reservas) */}
        <Route
          path="/reservas"
          element={
            <PrivateRoute>
              <MainLayout>
                <CalendarioReservas />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* NUEVA RESERVA Y WALK-IN */}
        <Route
          path="/reservas/nueva"
          element={
            <PrivateRoute>
              <MainLayout>
                <NuevaReserva />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/walkin/nuevo"
          element={
            <PrivateRoute>
              <MainLayout>
                <NuevoWalkIn />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* CHECK-IN (por id de reserva) */}
        <Route
          path="/checkin/:id"
          element={
            <PrivateRoute>
              <MainLayout>
                <CheckIn />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* MÓDULOS GENERALES */}
        <Route
          path="/huespedes"
          element={
            <PrivateRoute>
              <MainLayout>Huéspedes (pendiente de página)</MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/habitaciones"
          element={
            <PrivateRoute>
              <MainLayout>Habitaciones (pendiente de página)</MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/facturacion"
          element={
            <PrivateRoute>
              <MainLayout>Facturación (pendiente de página)</MainLayout>
            </PrivateRoute>
          }
        />

        {/* SOLO ADMIN */}
        <Route
          path="/configuracion"
          element={
            <PrivateRoute roles={["admin"]}>
              <MainLayout>Configuración</MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/usuarios"
          element={
            <PrivateRoute roles={["admin"]}>
              <MainLayout>Gestión de Usuarios</MainLayout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
