import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

export default function NuevoWalkIn() {
  const nav = useNavigate();
  const q = new URLSearchParams(useLocation().search);
  const [habNumero] = useState(q.get("hab") || "");
  const [desde] = useState(q.get("desde") || "");
  const [hasta] = useState(q.get("hasta") || "");
  const [nombre, setNombre] = useState("");
  const [error, setError] = useState("");

  const registrar = async () => {
    setError("");
    try {
      await axios.post("http://localhost:4000/api/reservas", {
        tipo: "walkin",                   // ✅ clave
        habitacion_numero: habNumero,
        fecha_inicio: desde,
        fecha_fin: hasta,
        huesped_nombre: nombre,
      });
      nav("/calendario");
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo registrar el Walk-In.");
    }
  };

  return (
    <div className="container-sm" style={{ maxWidth: 600, padding: 20 }}>
      <h2>Registrar Walk-In</h2>
      <p><b>Habitación:</b> {habNumero}</p>
      <p><b>Rango:</b> {desde} → {hasta}</p>

      <label>Nombre del huésped *</label>
      <input className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} />

      {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn btn-success" onClick={registrar} disabled={!nombre.trim()}>Registrar</button>
        <button className="btn" onClick={() => nav(-1)}>Cancelar</button>
      </div>
    </div>
  );
}
