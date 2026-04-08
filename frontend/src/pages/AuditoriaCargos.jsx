import { useEffect, useState } from "react";
import axios from "axios";
import { Button, Badge } from "react-bootstrap";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function AuditoriaCargos() {
  const [ocupadas, setOcupadas] = useState([]);
  const [preview, setPreview] = useState(null);
  const [resultado, setResultado] = useState(null);

  const [loadingOcupadas, setLoadingOcupadas] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExec, setLoadingExec] = useState(false);
  const [loadingCierre, setLoadingCierre] = useState(false);

  const cargarOcupadas = async () => {
    try {
      setLoadingOcupadas(true);
      const r = await axios.get(`${API}/api/auditoria/ocupadas`, { headers: getAuthHeaders() });
      setOcupadas(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error(e);
      alert("No se pudieron cargar las habitaciones ocupadas.");
      setOcupadas([]);
    } finally {
      setLoadingOcupadas(false);
    }
  };

  const cargarPreview = async () => {
    try {
      setLoadingPreview(true);
      const r = await axios.get(`${API}/api/auditoria/preview-alojamiento`, { headers: getAuthHeaders() });
      setPreview(r.data || null);
    } catch (e) {
      console.error(e);
      alert("No se pudo cargar el resumen (preview) de auditoría.");
      setPreview(null);
    } finally {
      setLoadingPreview(false);
    }
  };

  const refrescarTodo = async () => {
    setResultado(null);
    await cargarOcupadas();
    await cargarPreview();
  };

  const ejecutarAuditoria = async () => {
    if (loadingExec || loadingCierre) return;
    try {
      setLoadingExec(true);
      const r = await axios.post(`${API}/api/auditoria/generar-alojamiento`, {}, { headers: getAuthHeaders() });
      setResultado(r.data || null);
      await cargarPreview();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudo ejecutar auditoría.");
    } finally {
      setLoadingExec(false);
    }
  };

  const cierreDia = async () => {
    if (loadingExec || loadingCierre) return;
    try {
      setLoadingCierre(true);
      const r = await axios.post(`${API}/api/auditoria/cierre-dia`, {}, { headers: getAuthHeaders() });
      setResultado(r.data || null);
      // refrescar todo ya con fecha nueva
      await refrescarTodo();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudo ejecutar cierre del día.");
    } finally {
      setLoadingCierre(false);
    }
  };

  useEffect(() => {
    refrescarTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dataTabla = (resultado?.resumen || preview?.resumen || []);
  const fechaOperativaUI = resultado?.nuevaFechaOperativa || resultado?.fechaOperativa || preview?.fechaOperativa || "—";

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="mb-0">🧾 Auditoría del día (Cargos de alojamiento)</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Genera cargos de tarifa para TODAS las habitaciones ocupadas según la fecha operativa.
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={refrescarTodo} disabled={loadingOcupadas || loadingPreview}>
            ↻ Refrescar
          </Button>

          <Button variant="dark" onClick={ejecutarAuditoria} disabled={loadingExec || loadingCierre}>
            {loadingExec ? "Ejecutando..." : "Ejecutar auditoría (solo cargos)"}
          </Button>

          <Button variant="primary" onClick={cierreDia} disabled={loadingExec || loadingCierre}>
            {loadingCierre ? "Cerrando..." : "Cierre del día (auditoría + avanzar fecha)"}
          </Button>
        </div>
      </div>

      <div className="d-flex gap-2 flex-wrap mb-3">
        <Badge bg="secondary">Fecha operativa (UI): {fechaOperativaUI}</Badge>
      </div>

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="mb-2">Habitaciones ocupadas (check-in)</h5>

          {loadingOcupadas ? (
            <div className="text-muted">Cargando...</div>
          ) : ocupadas.length === 0 ? (
            <div className="alert alert-warning mb-0">No hay habitaciones ocupadas en la fecha operativa.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Hab</th>
                    <th>Reserva</th>
                    <th>Huésped</th>
                    <th>Plan</th>
                    <th>Ingreso</th>
                    <th>Salida</th>
                  </tr>
                </thead>
                <tbody>
                  {ocupadas.map((x) => (
                    <tr key={x.reserva_id}>
                      <td>{x.habitacion_numero}</td>
                      <td>#{x.reserva_id}</td>
                      <td>{x.huesped || ""}</td>
                      <td>{x.plan}</td>
                      <td>{String(x.fecha_inicio).slice(0, 10)}</td>
                      <td>{String(x.fecha_fin).slice(0, 10)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <h5 className="mb-2">Resultado / Resumen</h5>

          <div className="d-flex gap-2 flex-wrap mb-2">
            <Badge bg="secondary">Fecha operativa: {resultado?.fechaOperativa || preview?.fechaOperativa || "—"}</Badge>
            <Badge bg="dark">Total ocupadas: {resultado?.totalHabitaciones ?? preview?.totalHabitaciones ?? 0}</Badge>
            {"generados" in (resultado || {}) && <Badge bg="success">Generados: {resultado?.generados ?? 0}</Badge>}
            {"saltados" in (resultado || {}) && (
              <Badge bg="warning" text="dark">Saltados: {resultado?.saltados ?? 0}</Badge>
            )}
            {resultado?.nuevaFechaOperativa && <Badge bg="info">Nueva fecha: {resultado.nuevaFechaOperativa}</Badge>}
          </div>

          {loadingPreview ? (
            <div className="text-muted">Cargando resumen...</div>
          ) : dataTabla.length === 0 ? (
            <div className="text-muted">Sin datos para mostrar.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Hab</th>
                    <th>Reserva</th>
                    <th>Huésped</th>
                    <th>Plan</th>
                    <th>Fecha</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {dataTabla.map((x, idx) => (
                    <tr key={`${x.reserva_id}-${idx}`}>
                      <td>{x.habitacion_numero}</td>
                      <td>#{x.reserva_id}</td>
                      <td>{x.huesped || ""}</td>
                      <td>{x.plan}</td>
                      <td>{x.fecha}</td>
                      <td>{x.total}</td>
                      <td>
                        <Badge bg={x.estado === "generado" ? "success" : x.estado === "pendiente" ? "info" : "secondary"}>
                          {x.estado}
                        </Badge>
                      </td>
                      <td style={{ maxWidth: 420 }}>{x.motivo || ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resultado?.message && <div className="alert alert-info mb-0">{resultado.message}</div>}
        </div>
      </div>
    </div>
  );
}
