// src/routes/PrivateRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children, roles }) {
  const { usuario, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  // Si no hay usuario → volver al login
  if (!usuario) {
    return <Navigate to="/" replace />;
  }

  // Si se especifican roles y el del usuario no está permitido
  if (roles && !roles.includes(usuario.rol)) {
    // Lo mandamos al calendario por defecto
    return <Navigate to="/calendario" replace />;
  }

  return children;
}
