import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function NuevoBloqueo() {
  const nav = useNavigate();
  const q = new URLSearchParams(useLocation().search);

  const tipo = (q.get("tipo") || "").trim(); // mantenimiento | administrativo
  const hab = (q.get("hab") || "").trim();
  const desde = (q.get("desde") || "").trim();
  const hasta = (q.get("hasta") || "").trim();

  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const titulo = useMemo(() => {
    if (tipo === "mantenimiento") return "Bloqueo por mantenimiento";
    if (tipo === "administrativo") return "Bloqueo administrativo";
    return "Bloqueo";
  }, [tipo]);

  const registrar = async () => {
    setError("");
    if (!["mantenimiento", "administrativo"].includes(tipo)) {
      setError("Tipo inválido.");
      return;
    }
    if (!hab || !desde || !hasta) {
      setError("Faltan parámetros (hab/desde/hasta).");
      return;
    }

    try {
      setGuardando(true);
      await axios.post(
        `${API}/api/bloqueos`,
        {
          tipo,
          habitacion_numero: hab,
          fecha_inicio: desde,
          fecha_fin: hasta,
          motivo: motivo.trim() || null,
        },
        { headers: getAuthHeaders() }
      );
      nav("/calendario");
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo crear el bloqueo.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 720, paddingTop: 18 }}>
      <div className="card shadow-sm">
        <div className="card-body">
          <h3 className="mb-1">{titulo}</h3>
          <div className="text-muted">Habitación {hab} • {desde} → {hasta}</div>

          <hr />

          {error && <div className="alert alert-danger py-2">{error}</div>}

          <label className="form-label">Motivo (opcional)</label>
          <textarea
            className="form-control"
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej: pintura, fumigación, decisión administrativa..."
          />

          <div className="d-flex gap-2 mt-3">
            <button className="btn btn-primary" onClick={registrar} disabled={guardando}>
              {guardando ? "Guardando..." : "Crear bloqueo"}
            </button>
            <button className="btn btn-outline-secondary" onClick={() => nav(-1)} disabled={guardando}>
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
