
import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario,  setUsuario]  = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setCargando(false);
      return;
    }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));

      // Verificar que el token no haya expirado
      const ahora = Math.floor(Date.now() / 1000);
      if (payload.exp && payload.exp < ahora) {
        // Token expirado — limpia y redirige a login
        localStorage.removeItem("token");
        setCargando(false);
        return;
      }

      // Restaura el usuario desde el payload del token
      setUsuario({
        id:     payload.id,
        rol:    payload.rol,
        email:  payload.email  || "",
        nombre: payload.nombre || "",
      });
    } catch {
      localStorage.removeItem("token");
    } finally {
      setCargando(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const { data } = await axios.post(`${API}/api/auth/login`, { email, password });

      if (data.token) {
        localStorage.setItem("token", data.token);

        // Decodifica el payload para tener nombre y email disponibles
        const payload = JSON.parse(atob(data.token.split(".")[1]));

        setUsuario({
          id:     payload.id,
          rol:    data.rol || payload.rol,
          email:  payload.email  || email,
          nombre: payload.nombre || data.nombre || email,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}