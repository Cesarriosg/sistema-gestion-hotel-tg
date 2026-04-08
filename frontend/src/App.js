// src/App.jsx
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Navbar from "./layouts/Navbar";

import Login             from "./pages/Login";
import Dashboard         from "./pages/Dashboard";
import CalendarioRack    from "./pages/CalendarioRack";
import Reservas          from "./pages/Reservas";
import NuevaReserva      from "./pages/NuevaReserva";
import NuevaReservaLibre from "./pages/NuevaReservaLibre";
import CheckIn           from "./pages/CheckIn";
import NuevoWalkIn       from "./pages/NuevoWalkIn";
import FichaHuesped      from "./pages/FichaHuesped";
import Huespedes         from "./pages/Huespedes";
import CargosReserva     from "./pages/CargosReserva";
import Facturacion       from "./pages/Facturacion";
import NuevoBloqueo      from "./pages/NuevoBloqueo";
import RegistroReserva   from "./pages/RegistroReserva.jsx";
import FolioReserva        from "./pages/FolioReserva.jsx";
import Administracion    from "./pages/Administracion"; // Habitaciones + Tarifas unificado
import Usuarios          from "./pages/Usuarios";
import ConfigHotel       from "./pages/ConfigHotel";
import CierreDia         from "./pages/CierreDia";
import Reportes          from "./pages/Reportes";
import OTAs            from "./pages/OTAs";
import CheckoutReserva from "./pages/CheckoutReserva";
import Planes          from "./pages/Planes";
import Promociones     from "./pages/Promociones";

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

function PrivateRoute() {
  const { usuario, cargando } = useAuth();
  if (cargando) return null;
  return usuario ? <Outlet /> : <Navigate to="/login" replace />;
}

function AdminRoute() {
  const { usuario } = useAuth();
  return usuario?.rol === "admin" ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>

        <Route path="/login" element={<Login />} />

        <Route element={<PrivateRoute />}>
          <Route element={<LayoutPrincipal />}>

            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard"  element={<Dashboard />} />
            <Route path="/panel"      element={<Navigate to="/dashboard" replace />} />

            {/* Rack — única vista, el calendario fue absorbido */}
            <Route path="/rack"       element={<CalendarioRack />} />
            <Route path="/calendario" element={<Navigate to="/rack" replace />} />

            {/* Reservas */}
            <Route path="/reservas"              element={<Reservas />} />
            <Route path="/reservas/nueva"        element={<NuevaReservaLibre />} />
            <Route path="/reservas/nueva-manual" element={<NuevaReserva />} />
            <Route path="/reservas/:id/cargos"   element={<CargosReserva />} />
            <Route path="/reservas/:id"          element={<RegistroReserva />} />

            {/* Recepcion */}
            <Route path="/checkin/:id"   element={<CheckIn />} />
            <Route path="/walkin/nuevo"  element={<NuevoWalkIn />} />
            <Route path="/huespedes"     element={<Huespedes />} />
            <Route path="/huespedes/:id" element={<FichaHuesped />} />

            {/* Bloqueos */}
            <Route path="/bloqueos/nuevo" element={<NuevoBloqueo />} />

            {/* Facturacion, auditoria y reportes */}
            <Route path="/facturacion" element={<Facturacion />} />
            <Route path="/facturacion/:id" element={<CheckoutReserva />} />
            <Route path="/cierre-dia"  element={<CierreDia />} />
            <Route path="/reportes"    element={<Reportes />} />

            {/* OTAs — accesible para todos los usuarios autenticados */}
            <Route path="/otas" element={<OTAs />} />

            {/* Folio — accesible para cualquier usuario autenticado */}
            <Route path="/folio/:id"              element={<FolioReserva />} />
            <Route path="/registro/:id"          element={<RegistroReserva />} />
            <Route path="/registro-hotelero/:id" element={<RegistroReserva />} />

            {/* Solo admin */}
            <Route element={<AdminRoute />}>
              {/* Administracion unificada: Habitaciones + Tarifas */}
              <Route path="/administracion" element={<Administracion />} />
              <Route path="/planes"         element={<Planes />} />
              <Route path="/promociones"   element={<Promociones />} />
              {/* Redirige rutas antiguas al nuevo unificado */}
              <Route path="/habitaciones"   element={<Navigate to="/administracion" replace />} />
              <Route path="/tarifas"        element={<Navigate to="/administracion" replace />} />
              <Route path="/usuarios"       element={<Usuarios />} />
              <Route path="/config-hotel"   element={<ConfigHotel />} />
            </Route>

          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/dashboard" replace />} />

        </Routes>
    </BrowserRouter>
  );
}