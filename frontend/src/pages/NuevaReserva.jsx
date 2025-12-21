import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function NuevaReserva() {
  const nav = useNavigate();
  const q = new URLSearchParams(useLocation().search);

  const [habNumero] = useState(q.get("hab") || "");
  const [desde] = useState(q.get("desde") || "");
  const [hasta] = useState(q.get("hasta") || "");

  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");       // ✅ NUEVO
  const [notas, setNotas] = useState("");       // ✅ NUEVO

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const crear = async () => {
    setError("");
    if (!nombre.trim()) {
      setError("El nombre del huésped es obligatorio.");
      return;
    }

    try {
      setGuardando(true);
      await axios.post(
        "http://localhost:4000/api/reservas",
        {
          tipo: "reserva",
          habitacion_numero: habNumero,
          fecha_inicio: desde,
          fecha_fin: hasta,
          huesped_nombre: nombre.trim(),
          huesped_documento: documento.trim() || null,
          huesped_telefono: telefono.trim() || null,
          huesped_email: email.trim() || null,     // ✅ NUEVO
          notas: notas.trim() || null,             // ✅ NUEVO (HU-R6)
        },
        { headers: getAuthHeaders() }
      );

      nav("/calendario");
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;

      if (status === 409) {
        setError(msg || "La habitación ya está ocupada o reservada en ese rango.");
        return;
      }

      setError(msg || "No se pudo crear la reserva. Verifique la información.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="container-sm" style={{ maxWidth: 650, padding: 20 }}>
      <h2>Nueva reserva</h2>
      <p><b>Habitación:</b> {habNumero}</p>
      <p><b>Rango:</b> {desde} → {hasta}</p>

      <label>Nombre del huésped *</label>
      <input
        className="form-control"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <div className="row" style={{ marginTop: 10 }}>
        <div className="col-md-6">
          <label>Documento (opcional)</label>
          <input
            className="form-control"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label>Teléfono (opcional)</label>
          <input
            className="form-control"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
      </div>

      <label style={{ marginTop: 10 }}>Email (opcional)</label>
      <input
        className="form-control"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label style={{ marginTop: 10 }}>Notas internas (opcional)</label>
      <textarea
        className="form-control"
        rows={3}
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        placeholder="Ej: Llegará tarde, requiere cuna, alergias, etc."
      />

      {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          className="btn btn-primary"
          onClick={crear}
          disabled={guardando || !nombre.trim()}
        >
          {guardando ? "Creando..." : "Crear"}
        </button>

        <button className="btn btn-outline-secondary" onClick={() => nav(-1)} disabled={guardando}>
          Cancelar
        </button>
      </div>
    </div>
  );
}
