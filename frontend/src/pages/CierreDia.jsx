// src/pages/CierreDia.jsx
// ✅ Cierre de día: auditoría nocturna + avance de fecha operativa
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { Card, Table, Button, Badge, Alert, Spinner, Row, Col, Modal } from "react-bootstrap";
import hotelService from "../services/hotelService";


const money = (v) =>
  Number(v).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const estadoColor = (e) =>
  ({ generado: "success", saltado: "warning", error: "danger" }[e] || "secondary");
const estadoLabel = (e) =>
  ({ generado: "✅ Generado", saltado: "⏭️ Ya existía", error: "❌ Error" }[e] || e);

export default function CierreDia() {
  const [fechaOp,   setFechaOp]   = useState("");
  const [cargando,  setCargando]  = useState(true);
  const [preview,   setPreview]   = useState(null);
  const [cargandoPreview, setCargandoPreview] = useState(false);
  const [errPreview, setErrPreview] = useState("");

  // Ejecución cierre
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [ejecutando,   setEjecutando]   = useState(false);
  const [resultado,    setResultado]    = useState(null);
  const [errCierre,    setErrCierre]    = useState("");

  // ── Cargar fecha operativa ──────────────────────────────────────────────
  const cargarFecha = async () => {
    try {
      const { data } = await hotelService.fechaSistema();
      setFechaOp(data.fecha || dayjs().format("YYYY-MM-DD"));
    } catch { setFechaOp(dayjs().format("YYYY-MM-DD")); }
    finally { setCargando(false); }
  };

  useEffect(() => { cargarFecha(); }, []);

  // ── Cargar preview ────────────────────────────────────────────────────
  const cargarPreview = async () => {
    setCargandoPreview(true); setErrPreview(""); setPreview(null);
    try {
      const { data } = await hotelService.previewCierre();
      setPreview(data);
    } catch (e) {
      setErrPreview(e?.response?.data?.message || "No se pudo cargar el preview.");
    } finally {
      setCargandoPreview(false);
    }
  };

  useEffect(() => {
    if (fechaOp) cargarPreview();
  }, [fechaOp]); // eslint-disable-line

  // ── Ejecutar cierre ───────────────────────────────────────────────────
  const ejecutarCierre = async () => {
    setEjecutando(true); setErrCierre(""); setResultado(null);
    try {
      const { data } = await hotelService.ejecutarCierreDia();
      setResultado(data);
      setShowConfirm(false);
      await cargarFecha();
    } catch (e) {
      setErrCierre(e?.response?.data?.message || "Error al ejecutar el cierre.");
      setShowConfirm(false);
    } finally {
      setEjecutando(false);
    }
  };

  const totalPendiente = (preview?.resumen || [])
    .filter(r => r.estado === "pendiente")
    .reduce((s, r) => s + Number(r.total || 0), 0);

  if (cargando) {
    return <div className="text-center py-5"><Spinner animation="border" /></div>;
  }

  return (
    <div style={{ maxWidth: 1050, margin: "0 auto", paddingTop: 14, paddingBottom: 32 }}>

      {/* ── Encabezado ──────────────────────────────────────────────────── */}
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
            <div>
              <h3 className="mb-1"> Cierre de Día</h3>
              <p className="text-muted mb-0" style={{ fontSize: 13 }}>
                Genera los cargos de alojamiento del día operativo y avanza la fecha del sistema.
              </p>
            </div>
            <div className="text-end">
              <div className="text-muted" style={{ fontSize: 13 }}>Fecha operativa actual</div>
              <Badge bg="dark" style={{ fontSize: 16 }}>
                {dayjs(fechaOp).format("dddd DD/MM/YYYY")}
              </Badge>
            </div>
          </div>
        </Card.Body>
      </Card>

      {/* ── Resultado último cierre ──────────────────────────────────────── */}
      {resultado && (
        <Card className="shadow-sm mb-4 border-success">
          <Card.Body>
            <h5 className="text-success mb-3">✅ Cierre ejecutado correctamente</h5>
            <Row className="g-3 mb-3">
              <Col md={3}>
                <div className="p-3 rounded" style={{ background: "#f0fdf4" }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>Fecha cerrada</div>
                  <div className="fw-bold">{dayjs(resultado.fechaOperativa).format("DD/MM/YYYY")}</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="p-3 rounded" style={{ background: "#eff6ff" }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>Nueva fecha operativa</div>
                  <div className="fw-bold text-primary">{dayjs(resultado.nuevaFechaOperativa).format("DD/MM/YYYY")}</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="p-3 rounded" style={{ background: "#f0fdf4" }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>Cargos generados</div>
                  <div className="fw-bold text-success" style={{ fontSize: 20 }}>{resultado.generados}</div>
                </div>
              </Col>
              <Col md={3}>
                <div className="p-3 rounded" style={{ background: "#fff7ed" }}>
                  <div className="text-muted" style={{ fontSize: 12 }}>Ya existían</div>
                  <div className="fw-bold text-warning" style={{ fontSize: 20 }}>{resultado.saltados}</div>
                </div>
              </Col>
            </Row>

            {resultado.resumen?.length > 0 && (
              <div className="table-responsive">
                <Table size="sm" className="align-middle">
                  <thead className="table-success">
                    <tr>
                      <th>Hab.</th><th>Huésped</th><th>Plan</th><th>Cargo</th><th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultado.resumen.map((r, i) => (
                      <tr key={i}>
                        <td><b>{r.habitacion_numero}</b></td>
                        <td>{r.huesped || "—"}</td>
                        <td><Badge bg="primary">{r.plan}</Badge></td>
                        <td className="fw-bold">{r.total > 0 ? money(r.total) : "—"}</td>
                        <td><Badge bg={estadoColor(r.estado)}>{estadoLabel(r.estado)}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {errCierre && <Alert variant="danger" className="mb-4">{errCierre}</Alert>}

      {/* ── Preview del cierre ───────────────────────────────────────────── */}
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <h5 className="mb-0">📋 Preview del cierre</h5>
              <div className="text-muted" style={{ fontSize: 13 }}>
                Habitaciones que recibirán cargo de alojamiento al ejecutar el cierre.
              </div>
            </div>
            <Button variant="outline-secondary" size="sm" onClick={cargarPreview} disabled={cargandoPreview}>
              ↻ Actualizar
            </Button>
          </div>

          {errPreview && <Alert variant="danger" className="py-2">{errPreview}</Alert>}

          {cargandoPreview ? (
            <div className="text-center py-3"><Spinner animation="border" /></div>
          ) : !preview ? null : preview.totalHabitaciones === 0 ? (
            <Alert variant="info" className="py-2">
              No hay habitaciones ocupadas para la fecha operativa <b>{dayjs(fechaOp).format("DD/MM/YYYY")}</b>.
              No se generarán cargos de alojamiento.
            </Alert>
          ) : (
            <>
              <Row className="g-2 mb-3">
                <Col md={3}>
                  <div className="p-3 rounded text-center" style={{ background: "#eff6ff" }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>Habitaciones ocupadas</div>
                    <div className="fw-bold" style={{ fontSize: 22 }}>{preview.totalHabitaciones}</div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="p-3 rounded text-center" style={{ background: "#f0fdf4" }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>Cargos a generar</div>
                    <div className="fw-bold text-success" style={{ fontSize: 22 }}>
                      {(preview.resumen || []).filter(r => r.estado === "pendiente").length}
                    </div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="p-3 rounded text-center" style={{ background: "#fff7ed" }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>Ya tienen cargo</div>
                    <div className="fw-bold text-warning" style={{ fontSize: 22 }}>
                      {(preview.resumen || []).filter(r => r.estado === "saltado").length}
                    </div>
                  </div>
                </Col>
                <Col md={3}>
                  <div className="p-3 rounded text-center" style={{ background: "#f0fdf4" }}>
                    <div className="text-muted" style={{ fontSize: 12 }}>Total a cargar</div>
                    <div className="fw-bold text-success" style={{ fontSize: 18 }}>
                      {money(totalPendiente)}
                    </div>
                  </div>
                </Col>
              </Row>

              <div className="table-responsive">
                <Table striped size="sm" className="align-middle">
                  <thead className="table-dark">
                    <tr>
                      <th>Hab.</th><th>Tipo</th><th>Huésped</th>
                      <th>Plan</th><th>Cargo del día</th><th>Estado preview</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(preview.resumen || []).map((r, i) => (
                      <tr key={i}>
                        <td><b>{r.habitacion_numero}</b></td>
                        <td><small>{r.habitacion_tipo}</small></td>
                        <td>{r.huesped || <span className="text-muted">—</span>}</td>
                        <td><Badge bg="primary">{r.plan}</Badge></td>
                        <td className={r.total > 0 ? "fw-bold text-success" : "text-muted"}>
                          {r.total > 0 ? money(r.total) : "—"}
                        </td>
                        <td>
                          <Badge bg={r.estado === "pendiente" ? "success" : "warning"}>
                            {r.estado === "pendiente" ? "⏳ Pendiente" : "⏭️ Ya existe"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Card.Body>
      </Card>

      {/* ── Botón ejecutar cierre ─────────────────────────────────────────── */}
      <Card className="shadow-sm border-warning">
        <Card.Body>
          <h5 className="mb-1"> Ejecutar Cierre de Día</h5>
          <p className="text-muted mb-3" style={{ fontSize: 13 }}>
            Al ejecutar el cierre, se generarán los cargos de alojamiento para todas las habitaciones
            ocupadas y la fecha operativa avanzará automáticamente al día siguiente.
            Esta operación es <strong>idempotente</strong>: si un cargo ya existe no se duplica.
          </p>
          <Button
            variant="warning"
            size="lg"
            onClick={() => setShowConfirm(true)}
            disabled={ejecutando}
          >
            {ejecutando
              ? <><Spinner animation="border" size="sm" className="me-2" />Ejecutando cierre...</>
              : `Ejecutar cierre del día ${dayjs(fechaOp).format("DD/MM/YYYY")}`}
          </Button>
        </Card.Body>
      </Card>

      {/* ══ MODAL CONFIRMACIÓN ════════════════════════════════════════════════ */}
      <Modal show={showConfirm} onHide={() => setShowConfirm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Confirmar cierre de día</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Vas a ejecutar el cierre del día operativo <strong>{dayjs(fechaOp).format("DD/MM/YYYY")}</strong>.</p>
          <ul style={{ fontSize: 14 }}>
            <li>Se generarán <b>{(preview?.resumen || []).filter(r => r.estado === "pendiente").length}</b> cargos de alojamiento.</li>
            <li>La fecha operativa avanzará a <b>{dayjs(fechaOp).add(1, "day").format("DD/MM/YYYY")}</b>.</li>
            <li>Los cargos ya existentes no se duplican.</li>
          </ul>
          <Alert variant="warning" className="py-2 mb-0" style={{ fontSize: 13 }}>
            Esta acción afecta la contabilidad del hotel. Asegúrate de ejecutarla al final del día.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowConfirm(false)}>
            Cancelar
          </Button>
          <Button variant="warning" onClick={ejecutarCierre} disabled={ejecutando}>
            {ejecutando ? "Ejecutando..." : "Sí, ejecutar cierre"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}