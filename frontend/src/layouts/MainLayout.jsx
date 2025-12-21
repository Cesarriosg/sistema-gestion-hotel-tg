// src/layouts/MainLayout.jsx
import { Container, Nav, Navbar, NavDropdown, Button } from "react-bootstrap";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function MainLayout({ children }) {
  const { usuario, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/"); // volver al login
  };

  const isAdmin = usuario?.rol === "admin";

  return (
    <div className="d-flex flex-column" style={{ minHeight: "100vh" }}>
      {/* Barra superior tipo Zeus */}
      <Navbar bg="primary" variant="dark" expand="lg">
        <Container fluid>
          <Navbar.Brand as={Link} to="/calendario">
            🏨 Hotel Manager
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="main-navbar" />
          <Navbar.Collapse id="main-navbar">
            <Nav className="me-auto">

              {/* Menú Reservas */}
              <NavDropdown title="Reservas" id="nav-reservas">
                <NavDropdown.Item as={Link} to="/calendario">
                  Rack interactivo
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/reservas">
                  Calendario de reservas
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item as={Link} to="/reservas/nueva">
                  Crear reserva individual
                </NavDropdown.Item>
              </NavDropdown>

              {/* Menú Recepción */}
              <NavDropdown title="Recepción" id="nav-recepcion">
                <NavDropdown.Item as={Link} to="/walkin/nuevo">
                  Registro Walk-In
                </NavDropdown.Item>
                <NavDropdown.Item as={Link} to="/checkin/pendientes">
                  Huéspedes Check-In (pendiente)
                </NavDropdown.Item>
                <NavDropdown.Item as= {Link} to ="/huespedes">
                Gestión de Huéspedes
                </NavDropdown.Item>
              </NavDropdown>

              {/* Menú Auditoría (placeholder) */}
              <NavDropdown title="Auditoría" id="nav-auditoria">
                <NavDropdown.Item disabled>
                  Cargos a folios (pendiente)
                </NavDropdown.Item>
              </NavDropdown>

              {/* Menú Ama de Llaves (placeholder) */}
              <NavDropdown title="Ama de Llaves" id="nav-ama">
                <NavDropdown.Item as={Link} to="/habitaciones">
                  Estado de habitaciones
                </NavDropdown.Item>
              </NavDropdown>

              {/* Menú Facturación */}
              <Nav.Link as={Link} to="/facturacion">
                Facturación
              </Nav.Link>

              {/* Opciones solo Admin */}
              {isAdmin && (
                <>
                  <NavDropdown title="Administración" id="nav-admin">
                    <NavDropdown.Item as={Link} to="/panel">
                      Panel administrador
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/configuracion">
                      Configuración
                    </NavDropdown.Item>
                    <NavDropdown.Item as={Link} to="/usuarios">
                      Gestión de usuarios
                    </NavDropdown.Item>
                  </NavDropdown>
                </>
              )}
            </Nav>

            {/* Usuario + Cerrar sesión */}
            <div className="d-flex align-items-center gap-3">
              <span className="text-white">
                {usuario
                  ? `Bienvenido, ${usuario.email} (${usuario.rol})`
                  : "No autenticado"}
              </span>
              <Button variant="outline-light" size="sm" onClick={handleLogout}>
                Cerrar sesión
              </Button>
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Contenido de la página */}
      <Container fluid className="p-4 flex-grow-1 bg-light">
        {children}
      </Container>
    </div>
  );
}
