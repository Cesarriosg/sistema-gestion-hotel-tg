import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const navigate = useNavigate();

  const logout = () => {
    localStorage.clear();
    navigate("/");
  };

  return (
    <nav className="navbar navbar-dark bg-dark px-3">
      <span className="navbar-brand">🏨 Sistema Hotelero</span>
      <button className="btn btn-outline-light" onClick={logout}>
        Cerrar Sesión
      </button>
    </nav>
  );
}
