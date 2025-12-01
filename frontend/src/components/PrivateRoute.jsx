import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function PrivateRoute({ children }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/" />;
}
