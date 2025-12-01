import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await axios.post("http://localhost:4000/api/auth/login", {
        email,
        password,
      });

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("rol", res.data.rol);

      navigate("/panel"); // redirige al panel principal
    } catch (err) {
      setError("Credenciales incorrectas");
    }
  };

  return (
    <div style={{ maxWidth: "380px", margin: "80px auto", padding: "20px", border: "1px solid #ddd", borderRadius: "8px" }}>
      <h2 style={{ textAlign: "center" }}>Inicio de Sesión</h2>

      <form onSubmit={handleLogin}>
        <label>Correo</label>
        <input
          type="email"
          className="form-control"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label style={{ marginTop: "10px" }}>Contraseña</label>
        <input
          type="password"
          className="form-control"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <p style={{ color: "red", marginTop: "8px" }}>{error}</p>}

        <button type="submit" className="btn btn-primary w-100" style={{ marginTop: "15px" }}>
          Ingresar
        </button>
      </form>
    </div>
  );
}
