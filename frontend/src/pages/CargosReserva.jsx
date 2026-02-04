import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import { Button, Form, Badge } from "react-bootstrap";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function CargosReserva() {
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [reserva, setReserva] = useState(null);
  const [pagos, setPagos] = useState([]);

  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      setLoading(true);
      const r = await axios.get(`${API}/api/reservas/${id}/finanzas`, {
        headers: getAuthHeaders(),
      });

      setReserva(r.data?.reserva || null);
      setPagos(Array.isArray(r.data?.pagos) ? r.data.pagos : []);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudieron cargar los cargos.");
      setReserva(null);
      setPagos([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ✅ Cargos = pagos.tipo === 'cargo' (incluye manuales y auditoría)
  const cargos = useMemo(() => {
    return (pagos || []).filter((p) => String(p.tipo).toLowerCase() === "cargo");
  }, [pagos]);

  const totalCargos = useMemo(() => {
    return cargos.reduce((acc, c) => acc + Number(c.monto || 0), 0);
  }, [cargos]);

  const crearCargo = async () => {
    const m = Number(monto);
    if (!m || Number.isNaN(m) || m <= 0) {
      alert("Monto inválido.");
      return;
    }
    if (!descripcion.trim()) {
      alert("Escribe una descripción (ej: Minibar, Lavandería, etc.).");
      return;
    }

    try {
      setGuardando(true);

      // ✅ IMPORTANTE:
      // Tu backend registrarPago inserta en "referencia" (NO existe columna "descripcion" en tu tabla).
      // Entonces aquí mandamos "referencia" o mandamos "descripcion" pero el backend debe guardarlo en referencia.
      await axios.post(
        `${API}/api/reservas/${id}/pagos`,
        {
          monto: m,
          metodo: "otro",
          tipo: "cargo",
          referencia: descripcion.trim(), // ✅ alineado a tu tabla
        },
        { headers: getAuthHeaders() }
      );

      setMonto("");
      setDescripcion("");
      await cargar();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudo registrar el cargo.");
    } finally {
      setGuardando(false);
    }
  };

  const etiquetaCargo = (c) => {
    const ref = String(c.referencia || "").toUpperCase();
    if (ref.startsWith("AUDITORIA ALOJAMIENTO")) return "AUDITORÍA";
    return "MANUAL";
  };

  const fechaCargo = (c) => {
    // ✅ Si existe columna fecha (DATE), úsala como fecha operativa del cargo
    if (c.fecha) return dayjs(c.fecha).format("YYYY-MM-DD");
    // fallback
    return c.created_at ? dayjs(c.created_at).format("YYYY-MM-DD") : "—";
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="mb-0">🧾 Cargos (Folio) — Reserva #{id}</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Aquí se registran cargos manuales (minibar, lavandería, etc.) y también aparecerán los cargos generados por auditoría.
          </div>
        </div>

        <Button variant="outline-secondary" onClick={cargar} disabled={loading}>
          ↻ Refrescar
        </Button>
      </div>

      {reserva && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex gap-2 flex-wrap">
              <Badge bg="dark">Hab: {reserva.habitacion_numero}</Badge>
              <Badge bg="secondary">
                Rango: {String(reserva.fecha_inicio).slice(0, 10)} → {String(reserva.fecha_fin).slice(0, 10)}
              </Badge>
              <Badge bg={reserva.estado === "ocupada" ? "danger" : "info"}>
                Estado: {reserva.estado}
              </Badge>
            </div>
          </div>
        </div>
      )}

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="mb-2">Agregar cargo manual</h5>

          <div className="row g-2">
            <div className="col-md-3">
              <Form.Label className="mb-1">Monto</Form.Label>
              <Form.Control
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="Ej: 15000"
              />
            </div>
            <div className="col-md-7">
              <Form.Label className="mb-1">Descripción</Form.Label>
              <Form.Control
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Minibar / Lavandería / Restaurante..."
              />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <Button className="w-100" onClick={crearCargo} disabled={guardando}>
                {guardando ? "Guardando..." : "Agregar"}
              </Button>
            </div>
          </div>

          <div className="text-muted mt-2" style={{ fontSize: 12 }}>
            Nota: el método se guarda como <b>otro</b> para cumplir la restricción CHECK de tu tabla pagos.
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2">
            <h5 className="mb-0">Cargos registrados</h5>
            <Badge bg="dark">Total cargos: {totalCargos.toLocaleString("es-CO")}</Badge>
          </div>

          {loading ? (
            <div className="text-muted">Cargando...</div>
          ) : cargos.length === 0 ? (
            <div className="alert alert-warning mb-0">No hay cargos registrados para esta reserva.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Método</th>
                  </tr>
                </thead>
                <tbody>
                  {cargos.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Badge bg={etiquetaCargo(c) === "AUDITORÍA" ? "primary" : "secondary"}>
                          {etiquetaCargo(c)}
                        </Badge>
                      </td>
                      <td>{fechaCargo(c)}</td>
                      <td>{c.referencia || ""}</td>
                      <td>{Number(c.monto || 0).toLocaleString("es-CO")}</td>
                      <td>{c.metodo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
