// src/App.js
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Login from "./pages/Login";
import Panel from "./pages/Panel";
import MainLayout from "./layouts/MainLayout";
import PrivateRoute from "./routes/PrivateRoute";

import CalendarioRack from "./pages/CalendarioRack";
import CheckIn from "./pages/CheckIn";
import NuevaReserva from "./pages/NuevaReserva";
import NuevoWalkIn from "./pages/NuevoWalkIn";
import Reservas from "./pages/Reservas";
import DetalleReserva from "./pages/DetalleReserva";
import Huespedes from "./pages/Huespedes";
import Habitaciones from "./pages/Habitaciones";
import Facturacion from "./pages/Facturacion";
import NuevaReservaLibre from "./pages/NuevaReservaLibre";
import NuevoBloqueo from "./pages/NuevoBloqueo";
import CargosReserva from "./pages/CargosReserva";
import AuditoriaCargos from "./pages/AuditoriaCargos";
import Usuarios from "./pages/Usuarios";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ===================== */}
        {/* RUTAS PÚBLICAS */}
        {/* ===================== */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />

        {/* ===================== */}
        {/* RACK / PANTALLA PRINCIPAL */}
        {/* ===================== */}
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

        {/* ===================== */}
        {/* BLOQUEOS */}
        {/* ===================== */}
        <Route
          path="/bloqueos/nuevo"
          element={
            <PrivateRoute>
              <MainLayout>
                <NuevoBloqueo />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* ===================== */}
        {/* CARGOS POR RESERVA */}
        {/* ===================== */}
        <Route
          path="/reservas/:id/cargos"
          element={
            <PrivateRoute>
              <MainLayout>
                <CargosReserva />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* ===================== */}
        {/* ✅ AUDITORÍA GLOBAL */}
        {/* ===================== */}
        <Route
          path="/auditoria/cargos-folios"
          element={
            <PrivateRoute>
              <MainLayout>
                <AuditoriaCargos />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* ===================== */}
        {/* PANEL SOLO ADMIN */}
        {/* ===================== */}
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

        {/* ===================== */}
        {/* RESERVAS */}
        {/* ===================== */}
        <Route
          path="/reservas"
          element={
            <PrivateRoute>
              <MainLayout>
                <Reservas />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/reservas/nueva-manual"
          element={
            <PrivateRoute>
              <MainLayout>
                <NuevaReservaLibre />
              </MainLayout>
            </PrivateRoute>
          }
        />

        <Route
          path="/reservas/:id"
          element={
            <PrivateRoute>
              <MainLayout>
                <DetalleReserva />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* ===================== */}
        {/* NUEVA RESERVA / WALK-IN */}
        {/* ===================== */}
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

        {/* ===================== */}
        {/* CHECK-IN */}
        {/* ===================== */}
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

        {/* ===================== */}
        {/* MÓDULOS GENERALES */}
        {/* ===================== */}
        <Route
          path="/huespedes"
          element={
            <PrivateRoute>
              <MainLayout>
                <Huespedes />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* ✅ si esta pantalla es administración, déjala SOLO ADMIN */}
        <Route
          path="/habitaciones"
          element={
            <PrivateRoute roles={["admin"]}>
              <MainLayout>
                <Habitaciones />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* ===================== */}
        {/* FACTURACIÓN */}
        {/* ===================== */}
        <Route
          path="/facturacion"
          element={
            <PrivateRoute>
              <MainLayout>
                <Facturacion />
              </MainLayout>
            </PrivateRoute>
          }
        />

        {/* ===================== */}
        {/* SOLO ADMIN */}
        {/* ===================== */}
        <Route
          path="/configuracion"
          element={
            <PrivateRoute roles={["admin"]}>
              <MainLayout>Configuración</MainLayout>
            </PrivateRoute>
          }
        />

        {/* ✅ AQUÍ EL CAMBIO CLAVE */}
        <Route
          path="/usuarios"
          element={
            <PrivateRoute roles={["admin"]}>
              <MainLayout>
                <Usuarios />
              </MainLayout>
            </PrivateRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
