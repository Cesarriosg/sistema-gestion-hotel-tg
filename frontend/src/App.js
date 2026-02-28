
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar from "./layouts/Navbar";

// Páginas
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CalendarioRack from "./pages/CalendarioRack";
import Reservas from "./pages/Reservas";
import NuevaReserva from "./pages/NuevaReserva";
import NuevaReservaLibre from "./pages/NuevaReservaLibre";
import CheckIn from "./pages/CheckIn";
import NuevoWalkIn from "./pages/NuevoWalkIn";
import Huespedes from "./pages/Huespedes";
import CargosReserva from "./pages/CargosReserva";
import Facturacion from "./pages/Facturacion";
import NuevoBloqueo from "./pages/NuevoBloqueo";
import Habitaciones from "./pages/Habitaciones";
import Tarifas from "./pages/Tarifas";
import Usuarios from "./pages/Usuarios";
import ConfigHotel from "./pages/ConfigHotel";
import CierreDia from "./pages/CierreDia";

// Layout con Navbar 
function LayoutPrincipal() {
  return (
    <div style={{ minHeight: "100vh", background: "#f4f6f9" }}>
      <Navbar />
      <div style={{ padding: "20px" }}>
        <Outlet />
      </div>
    </div>
  );
}

// Guard: redirige a /login si no hay sesión
function PrivateRoute() {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  return usuario ? <Outlet /> : <Navigate to="/login" replace />;
}

// Guard: solo admin, redirige al dashboard si no tiene permisos
function AdminRoute() {
  const { usuario } = useAuth();
  return usuario?.rol === "admin" ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Ruta pública */}
        <Route path="/login" element={<Login />} />

        {/* Rutas protegidas — un único LayoutPrincipal con Navbar */}
        <Route element={<PrivateRoute />}>
          <Route element={<LayoutPrincipal />}>

            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<Dashboard />} />

            {/* Redirige rutas antiguas */}
            <Route path="/panel"      element={<Navigate to="/dashboard" replace />} />
            <Route path="/calendario" element={<CalendarioRack />} />
            <Route path="/rack"       element={<CalendarioRack />} />

            {/* Reservas */}
            <Route path="/reservas"               element={<Reservas />} />
            <Route path="/reservas/nueva"         element={<NuevaReservaLibre />} />
            <Route path="/reservas/nueva-manual"  element={<NuevaReserva />} />
            {/* IMPORTANTE: rutas estáticas antes de /:id */}
            <Route path="/reservas/:id/cargos"    element={<CargosReserva />} />
            <Route path="/reservas/:id"           element={<CargosReserva />} />

            {/* Recepción */}
            <Route path="/checkin/:id"   element={<CheckIn />} />
            <Route path="/walkin/nuevo"  element={<NuevoWalkIn />} />
            <Route path="/huespedes"     element={<Huespedes />} />

            {/* Bloqueos */}
            <Route path="/bloqueos/nuevo" element={<NuevoBloqueo />} />

            {/* Facturación y auditoría */}
            <Route path="/facturacion" element={<Facturacion />} />
            <Route path="/cierre-dia"  element={<CierreDia />} />

            {/* Solo administrador */}
            <Route element={<AdminRoute />}>
              <Route path="/habitaciones" element={<Habitaciones />} />
              <Route path="/tarifas"      element={<Tarifas />} />
              <Route path="/usuarios"     element={<Usuarios />} />
              <Route path="/config-hotel" element={<ConfigHotel />} />
            </Route>

          </Route>
        </Route>

        {/* Cualquier ruta no encontrada va al dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />

      </Routes>
    </BrowserRouter>
  );
}