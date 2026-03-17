// src/pages/Login.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    const ok = await login(email, password);

    if (ok) {
      navigate("/dashboard");
    } else {
      setError("Credenciales incorrectas. Verifique su correo y contrasena.");
    }
    setCargando(false);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f6f9",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "#fff",
          borderRadius: 10,
          padding: "36px 32px",
          boxShadow: "0 2px 16px rgba(0,0,0,0.10)",
        }}
      >
        <div className="text-center mb-4">
          <div style={{ fontSize: 32, marginBottom: 8 }}></div>
          <h4 className="mb-0" style={{ fontWeight: 700, color: "#1a1a2e" }}>
            Hotel Manager
          </h4>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Sistema de gestion hotelera
          </div>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-3">
            <label className="form-label" style={{ fontWeight: 500 }}>
              Correo electronico
            </label>
            <input
              type="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=""
              required
              autoFocus
            />
          </div>

          <div className="mb-3">
            <label className="form-label" style={{ fontWeight: 500 }}>
              Contrasena
            </label>
            <input
              type="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=""
              required
            />
          </div>

          {error && (
            <div className="alert alert-danger py-2 mb-3" style={{ fontSize: 13 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary w-100"
            style={{ fontWeight: 600 }}
            disabled={cargando}
          >
            {cargando ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}