// src/context/AuthContext.js
import { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);

  // Cargar sesión desde localStorage al arrancar
  useEffect(() => {
    const token = localStorage.getItem("token");
    const rol = localStorage.getItem("rol");
    const email = localStorage.getItem("email");

    if (token && rol) {
      setUsuario({ email, rol });
    }
    setLoading(false);
  }, []);

  // login centralizado
  const login = async (email, password) => {
    try {
      const res = await axios.post("http://localhost:4000/api/auth/login", {
        email,
        password,
      });

      // El backend debe devolver al menos: { token, rol }
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("rol", res.data.rol);
      localStorage.setItem("email", email);

      setUsuario({ email, rol: res.data.rol });
      return true;
    } catch (error) {
      console.error("Error de login:", error?.response?.data || error.message);
      return false;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("rol");
    localStorage.removeItem("email");
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
