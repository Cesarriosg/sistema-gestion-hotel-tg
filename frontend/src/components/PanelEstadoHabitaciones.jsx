import { useEffect, useState } from "react";
import axios from "axios";
import { Button, Card, Form, Table, Badge, Modal } from "react-bootstrap";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const badgeVariant = (estado) => {
  if (estado === "disponible") return "success";
  if (estado === "reservada") return "info";
  if (estado === "ocupada") return "danger";
  if (estado === "mantenimiento") return "warning";
  if (estado === "fuera_servicio") return "secondary";
  return "dark";
};

export default function PanelEstadoHabitaciones() {
  const [habitaciones, setHabitaciones] = useState([]);
  const [estado, setEstado] = useState("todas");
  const [tipo, setTipo] = useState("todas");
  const [q, setQ] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const [showConfirm, setShowConfirm] = useState(false);
  const [targetHab, setTargetHab] = useState(null);
  const [nuevoEstado, setNuevoEstado] = useState("");

  const cargar = async () => {
    try {
      setLoading(true);
      setErr("");

      const r = await axios.get(`${API}/api/habitaciones`, {
        params: { estado, tipo, q },
        headers: getAuthHeaders(),
      });
      setHabitaciones(r.data || []);
    } catch (e) {
      setErr(e?.response?.data?.message || "No se pudieron cargar las habitaciones.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado, tipo]);

  const abrirConfirm = (hab, est) => {
    setTargetHab(hab);
    setNuevoEstado(est);
    setShowConfirm(true);
  };

  const confirmarCambio = async () => {
    if (!targetHab?.id || !nuevoEstado) return;

    try {
      setLoading(true);
      setErr("");

      await axios.put(
        `${API}/api/habitaciones/${targetHab.id}/estado`,
        { estado: nuevoEstado },
        { headers: getAuthHeaders() }
      );

      setShowConfirm(false);
      setTargetHab(null);
      setNuevoEstado("");
      await cargar();
    } catch (e) {
      setErr(e?.response?.data?.message || "No se pudo cambiar el estado.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div>
            <h5 className="mb-0">Control de habitaciones</h5>
            <div className="text-muted" style={{ fontSize: 13 }}>
              Cambia estado (mantenimiento/fuera de servicio) y filtra por estado.
            </div>
          </div>
          <Button variant="outline-secondary" size="sm" onClick={cargar} disabled={loading}>
            {loading ? "Actualizando..." : "↻ Refrescar"}
          </Button>
        </div>

        {err && <div className="alert alert-danger py-2 mt-3 mb-0">{err}</div>}

        <div className="row g-2 mt-3">
          <div className="col-md-3">
            <Form.Label className="mb-1">Estado</Form.Label>
            <Form.Select value={estado} onChange={(e) => setEstado(e.target.value)}>
              <option value="todas">Todas</option>
              <option value="disponible">Disponible</option>
              <option value="reservada">Reservada</option>
              <option value="ocupada">Ocupada</option>
              <option value="mantenimiento">Mantenimiento</option>
              <option value="fuera_servicio">Fuera de servicio</option>
            </Form.Select>
          </div>

          <div className="col-md-3">
            <Form.Label className="mb-1">Tipo</Form.Label>
            <Form.Select value={tipo} onChange={(e) => setTipo(e.target.value)}>
              <option value="todas">Todos</option>
              {/* Ajusta opciones a tus tipos reales */}
              <option value="SENCILLA">Sencilla</option>
              <option value="DOBLE">Doble</option>
              <option value="TRIPLE">Triple</option>
            </Form.Select>
          </div>

          <div className="col-md-4">
            <Form.Label className="mb-1">Buscar (número)</Form.Label>
            <Form.Control
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Ej: 101"
              onKeyDown={(e) => {
                if (e.key === "Enter") cargar();
              }}
            />
          </div>

          <div className="col-md-2 d-flex align-items-end">
            <Button className="w-100" variant="primary" onClick={cargar} disabled={loading}>
              Buscar
            </Button>
          </div>
        </div>

        <div className="table-responsive mt-3">
          <Table bordered hover size="sm" className="mb-0">
            <thead>
              <tr>
                <th>Número</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th style={{ width: 280 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {habitaciones.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-muted">
                    No hay habitaciones para mostrar.
                  </td>
                </tr>
              ) : (
                habitaciones.map((h) => (
                  <tr key={h.id}>
                    <td className="fw-semibold">{h.numero}</td>
                    <td>{h.tipo}</td>
                    <td>
                      <Badge bg={badgeVariant(h.estado)}>{h.estado}</Badge>
                    </td>
                    <td className="d-flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline-warning"
                        onClick={() => abrirConfirm(h, "mantenimiento")}
                        disabled={loading}
                      >
                        🛠 Mantenimiento
                      </Button>

                      <Button
                        size="sm"
                        variant="outline-secondary"
                        onClick={() => abrirConfirm(h, "fuera_servicio")}
                        disabled={loading}
                      >
                        ⛔ Fuera servicio
                      </Button>

                      <Button
                        size="sm"
                        variant="outline-success"
                        onClick={() => abrirConfirm(h, "disponible")}
                        disabled={loading}
                      >
                        ✅ Marcar disponible
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>
      </Card.Body>

      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar cambio de estado</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          ¿Seguro que deseas cambiar la habitación <b>{targetHab?.numero}</b> a{" "}
          <b>{nuevoEstado}</b>?
          <div className="text-muted mt-2" style={{ fontSize: 13 }}>
            Esto impacta la disponibilidad en el rack.
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowConfirm(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirmarCambio} disabled={loading}>
            {loading ? "Guardando..." : "Sí, cambiar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </Card>
  );
}
