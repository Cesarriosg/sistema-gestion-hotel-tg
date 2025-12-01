import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Panel from "./pages/Panel";
import MainLayout from "./layouts/MainLayout";
//import PrivateRoute from "./components/PrivateRoute";
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

        <Route path="/" element={<Login />} />
        <Route path="/rack" element={< PrivateRoute > <Panel /> </PrivateRoute>} />
        <Route path="/calendario" element={<CalendarioRack />} />
        <Route path="/panel" element={< PrivateRoute > <Panel /> </PrivateRoute>} />
        <Route path="/checkin/:id" element={<CheckIn />} />

        <Route path="/reservas/nueva" element={<NuevaReserva />} />
        <Route path="/walkin/nuevo" element={<NuevoWalkIn />} />

         {/* <Route path="/reservas/:id" element={<DetalleReserva />} /> */}


        <Route path="/reservas" element={<PrivateRoute><MainLayout>Gestión de reservas</MainLayout></PrivateRoute>} />
        <Route path="/huespedes" element={<PrivateRoute><MainLayout>Huéspedes</MainLayout></PrivateRoute>} />
        <Route path="/habitaciones" element={<PrivateRoute><MainLayout>Habitaciones</MainLayout></PrivateRoute>} />
        <Route path="/facturacion" element={<PrivateRoute><MainLayout>Facturación</MainLayout></PrivateRoute>} />

        {/* Calendario */}
        <Route path="/calendario" element={<PrivateRoute><CalendarioReservas /></PrivateRoute>} />

        <Route path="/calendario" element={<CalendarioRack />} />

        <Route path="/calendario" element={<CalendarioReservas />} />


        {/* Rutas solo admin */}
        <Route path="/configuracion" element={<PrivateRoute><MainLayout>Configuración</MainLayout></PrivateRoute>} />
        <Route path="/usuarios" element={<PrivateRoute><MainLayout>Gestión de Usuarios</MainLayout></PrivateRoute>} />

      </Routes>
    </BrowserRouter>
  );
}
