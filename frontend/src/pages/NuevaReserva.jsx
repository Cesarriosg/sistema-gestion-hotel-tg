import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

export default function NuevaReserva() {
  const nav = useNavigate();
  const q = new URLSearchParams(useLocation().search);
  const [habNumero] = useState(q.get("hab") || "");
  const [desde] = useState(q.get("desde") || "");
  const [hasta] = useState(q.get("hasta") || "");
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState("");

  const crear = async () => {
    setError("");
    try {
      await axios.post("http://localhost:4000/api/reservas", {
        tipo: "reserva",                 // ✅ clave
        habitacion_numero: habNumero,
        fecha_inicio: desde,
        fecha_fin: hasta,
        huesped_nombre: nombre,
        huesped_documento: documento || null,
        huesped_telefono: telefono || null,
      });
      nav("/calendario"); // recarga rack
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo crear la reserva. Verifique la información.");
    }
  };

  return (
    <div className="container-sm" style={{ maxWidth: 600, padding: 20 }}>
      <h2>Nueva reserva</h2>
      <p><b>Habitación:</b> {habNumero}</p>
      <p><b>Rango:</b> {desde} → {hasta}</p>

      <label>Nombre del huésped *</label>
      <input className="form-control" value={nombre} onChange={(e) => setNombre(e.target.value)} />

      <label style={{ marginTop: 10 }}>Documento (opcional)</label>
      <input className="form-control" value={documento} onChange={(e) => setDocumento(e.target.value)} />

      <label style={{ marginTop: 10 }}>Teléfono (opcional)</label>
      <input className="form-control" value={telefono} onChange={(e) => setTelefono(e.target.value)} />

      {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button className="btn btn-primary" onClick={crear} disabled={!nombre.trim()}>Crear</button>
        <button className="btn" onClick={() => nav(-1)}>Cancelar</button>
      </div>
    </div>
  );
}
