import { Container, Nav, Navbar, Button } from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { FaBed, FaUsers, FaDoorOpen, FaFileInvoice, FaCogs, FaUserShield } from "react-icons/fa";

export default function MainLayout({ children }) {
  const { usuario, logout } = useAuth();

  return (
    <div className="d-flex" style={{ minHeight: "100vh" }}>

      {/* Sidebar */}
      <div className="bg-dark text-white p-3" style={{ width: "250px" }}>
        <h4 className="text-center mb-4">🏨 Hotel Manager</h4>

        <Nav className="flex-column gap-2">

          <Link className="nav-link text-white" to="/reservas"><FaBed /> Gestión de Reservas</Link>
          <Link className="nav-link text-white" to="/huespedes"><FaUsers /> Huéspedes</Link>
          <Link className="nav-link text-white" to="/habitaciones"><FaDoorOpen /> Habitaciones</Link>
          <Link className="nav-link text-white" to="/facturacion"><FaFileInvoice /> Facturación</Link>

          {/* Opciones SOLO para Admin */}
          {usuario?.rol === "admin" && (
            <>
              <hr className="text-light" />
              <Link className="nav-link text-white" to="/configuracion"><FaCogs /> Configuración</Link>
              <Link className="nav-link text-white" to="/usuarios"><FaUserShield /> Gestión de Usuarios</Link>
            </>
          )}
        </Nav>
      </div>

      {/* Main Content */}
      <div className="flex-grow-1 d-flex flex-column">

        {/* Navbar Superior */}
        <Navbar bg="light" className="shadow-sm px-3">
          <Navbar.Text className="me-auto">
            Bienvenido, <strong>{usuario?.nombre}</strong>
          </Navbar.Text>

          <Button variant="outline-danger" onClick={logout}>
            Cerrar sesión
          </Button>
        </Navbar>

        {/* Contenido dinámico */}
        <Container fluid className="p-4">
          {children}
        </Container>
        <Link className="nav-link text-white" to="/calendario">🗓️ Calendario</Link>
      </div>
    </div>
  );
}
