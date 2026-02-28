import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { usuario, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isAdmin   = usuario?.rol === "admin";

  const [openMenu, setOpenMenu] = useState(null);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const isActive = (paths) =>
    paths.some((p) =>
      typeof p === "string"
        ? location.pathname.startsWith(p)
        : p.test(location.pathname)
    );

  const toggle = (menu) => setOpenMenu((prev) => (prev === menu ? null : menu));
  const close  = ()     => setOpenMenu(null);

  return (
    <>
      {}
      {openMenu && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 999 }}
          onClick={close}
        />
      )}

      <nav
        className="navbar navbar-dark"
        style={{
          background: "#1565c0",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          padding: "0 1rem",
          minHeight: 48,
        }}
      >
        <div className="container-fluid px-0 gap-1">

          {}
          <Link
            className="navbar-brand fw-bold me-4 mb-0"
            to="/dashboard"
            onClick={close}
            style={{ fontSize: 16, letterSpacing: "0.3px" }}
          >
            Hotel Manager
          </Link>

          {/* Menús de navegación */}
          <div className="d-flex align-items-center gap-1 flex-grow-1">

            {/* Reservas */}
            <NavDropdown
              label="Reservas"
              open={openMenu === "reservas"}
              active={isActive(["/reservas", "/calendario", "/rack"])}
              onToggle={() => toggle("reservas")}
            >
              <DropItem to="/rack"               label="Rack interactivo"       onClose={close} />
              <DropItem to="/calendario"         label="Calendario de reservas" onClose={close} />
              <DropItem to="/reservas"           label="Lista de reservas"      onClose={close} />
              <DropItem to="/reservas/nueva"     label="Crear reserva"          onClose={close} />
            </NavDropdown>

            {/* Recepcion */}
            <NavDropdown
              label="Recepcion"
              open={openMenu === "recepcion"}
              active={isActive(["/walkin", "/checkin", "/huespedes"])}
              onToggle={() => toggle("recepcion")}
            >
              <DropItem to="/walkin/nuevo" label="Nuevo Walk-In" onClose={close} />
              <DropItem to="/huespedes"    label="Huespedes"     onClose={close} />
            </NavDropdown>

            {/* Auditoria */}
            <NavDropdown
              label="Auditoria"
              open={openMenu === "auditoria"}
              active={isActive(["/cierre-dia"])}
              onToggle={() => toggle("auditoria")}
            >
              <DropItem to="/cierre-dia" label="Cierre de dia" onClose={close} />
            </NavDropdown>

            {/* Facturacion */}
            <NavLink
              to="/facturacion"
              label="Facturacion"
              active={isActive(["/facturacion"])}
              onClick={close}
            />

            {/* Administracion — solo admin */}
            {isAdmin && (
              <NavDropdown
                label="Administracion"
                open={openMenu === "admin"}
                active={isActive(["/habitaciones", "/tarifas", "/usuarios", "/config-hotel"])}
                onToggle={() => toggle("admin")}
              >
                <DropItem to="/habitaciones" label="Habitaciones"          onClose={close} />
                <DropItem to="/tarifas"      label="Tarifas y planes"      onClose={close} />
                <DropItem to="/usuarios"     label="Usuarios del sistema"  onClose={close} />
                <hr className="dropdown-divider my-1" />
                <DropItem to="/config-hotel" label="Configuracion del hotel" onClose={close} />
              </NavDropdown>
            )}
          </div>

          {/* Usuario y cierre de sesion */}
          <div className="d-flex align-items-center gap-2 ms-auto">
            <span
              className="text-white-50 d-none d-md-inline"
              style={{ fontSize: 13 }}
            >
              {usuario?.nombre || usuario?.email || "Usuario"}
              {" "}
              <span
                className="badge ms-1"
                style={{
                  background: isAdmin ? "#ffd600" : "#42a5f5",
                  color:      isAdmin ? "#000"    : "#fff",
                  fontSize:   11,
                  fontWeight: 500,
                }}
              >
                {usuario?.rol || ""}
              </span>
            </span>

            <button
              className="btn btn-sm btn-outline-light"
              onClick={handleLogout}
              style={{ fontSize: 13 }}
            >
              Cerrar sesion
            </button>
          </div>

        </div>
      </nav>
    </>
  );
}

// ─── Subcomponentes ───────────────────────────────────────────────────────────

function NavDropdown({ label, open, active, onToggle, children }) {
  return (
    <div className="position-relative">
      <button
        className="btn btn-sm px-2 py-1"
        onClick={onToggle}
        style={{
          color:      active ? "#fff" : "rgba(255,255,255,0.85)",
          background: active ? "rgba(255,255,255,0.15)" : "transparent",
          border:     "none",
          fontSize:   14,
          fontWeight: active ? 600 : 400,
          borderRadius: 4,
          whiteSpace: "nowrap",
        }}
      >
        {label} <span style={{ fontSize: 9, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div
          className="position-absolute shadow rounded py-1"
          style={{
            top:       "calc(100% + 2px)",
            left:      0,
            minWidth:  210,
            background: "#fff",
            zIndex:    1001,
            border:    "1px solid rgba(0,0,0,0.1)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

function DropItem({ to, label, onClose }) {
  const location = useLocation();
  const active   = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClose}
      className="d-flex align-items-center px-3 py-2 text-decoration-none"
      style={{
        color:      active ? "#1565c0" : "#1a1a2e",
        background: active ? "#e3f2fd" : "transparent",
        fontSize:   14,
        fontWeight: active ? 600 : 400,
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#f5f5f5"; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
    >
      {label}
    </Link>
  );
}

function NavLink({ to, label, active, onClick }) {
  return (
    <Link
      to={to}
      onClick={onClick}
      style={{
        color:      active ? "#fff" : "rgba(255,255,255,0.85)",
        background: active ? "rgba(255,255,255,0.15)" : "transparent",
        border:     "none",
        fontSize:   14,
        fontWeight: active ? 600 : 400,
        borderRadius: 4,
        textDecoration: "none",
        padding:    "4px 8px",
        whiteSpace: "nowrap",
        display:    "inline-block",
      }}
    >
      {label}
    </Link>
  );
}