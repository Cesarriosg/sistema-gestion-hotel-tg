
import { useEffect, useRef, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import * as XLSX from "xlsx";
import {
  Button, Card, Col, Form, Modal, Row, Table, Tabs, Tab, Spinner, Badge,
} from "react-bootstrap";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";
const getAuth = () => {
  const t = localStorage.getItem("token");
  return t ? { headers: { Authorization: `Bearer ${t}` } } : {};
};

const fmtF  = (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "—");
const fmtFH = (f) => (f ? dayjs(f).format("DD/MM/YYYY HH:mm") : "—");
const fmtMon = (v) => {
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
};

const ESTADO_PAGO_COLOR = {
  pagada:   "success",
  abonada:  "warning",
  pendiente:"danger",
  anulada:  "secondary",
};

export default function Facturacion() {
  const [facturas, setFacturas] = useState([]);
  const [pagos,    setPagos]    = useState([]);

  // Filtros
  const [desde,      setDesde]      = useState("");
  const [hasta,      setHasta]      = useState("");
  const [fEstado,    setFEstado]    = useState("");
  const [pMetodo,    setPMetodo]    = useState("");
  const [pTipo,      setPTipo]      = useState("");
  const [tab,        setTab]        = useState("facturas");

  // Modal ver factura
  const [facturaSel,       setFacturaSel]       = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [cargandoFactura,  setCargandoFactura]  = useState(false);

  // Anular
  const [motivoAnular,  setMotivoAnular]  = useState("");
  const [showAnular,    setShowAnular]    = useState(false);
  const [anulandoId,    setAnulandoId]    = useState(null);
  const [guardandoAnul, setGuardandoAnul] = useState(false);

  const printRef = useRef(null);

  const cargarFacturas = async () => {
    try {
      const params = {};
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;
      if (fEstado) params.estado = fEstado;
      const r = await axios.get(`${API}/api/facturacion/facturas`, { params, ...getAuth() });
      setFacturas(r.data || []);
    } catch (e) {
      console.error("Error cargando facturas:", e);
    }
  };

  const cargarPagos = async () => {
    try {
      const params = {};
      if (desde)  params.desde  = desde;
      if (hasta)  params.hasta  = hasta;
      if (pMetodo) params.metodo = pMetodo;
      if (pTipo)   params.tipo   = pTipo;
      const r = await axios.get(`${API}/api/facturacion/pagos`, { params, ...getAuth() });
      setPagos(r.data || []);
    } catch (e) {
      console.error("Error cargando pagos:", e);
    }
  };

  useEffect(() => { cargarFacturas(); cargarPagos(); }, []); // eslint-disable-line

  const aplicarFiltros = () => { cargarFacturas(); cargarPagos(); };

  const abrirFactura = async (facturaId) => {
    setShowFacturaModal(true);
    setCargandoFactura(true);
    setFacturaSel(null);
    try {
      const r = await axios.get(`${API}/api/facturacion/facturas/${facturaId}`, getAuth());
      setFacturaSel(r.data);
    } catch (e) {
      alert(e.response?.data?.message || "No se pudo obtener la factura.");
      setShowFacturaModal(false);
    } finally {
      setCargandoFactura(false);
    }
  };

  const cerrarModal = () => { setShowFacturaModal(false); setFacturaSel(null); };

  // ── Imprimir / PDF ──────────────────────────────────────────────────────────
  const imprimirFactura = () => {
    const cab = facturaSel?.cabecera ? facturaSel.cabecera : facturaSel;
    const detalle = facturaSel?.detalle || [];
    const w = window.open("", "_blank");
    w.document.write(`<html><head><title>Factura #${cab?.id}</title>
    <style>
      body{font-family:system-ui;font-size:13px;color:#1a1a2e;padding:32px}
      h2{margin:0 0 4px;font-size:20px}
      .sub{color:#6b7280;font-size:12px;margin-bottom:20px}
      .row{display:flex;gap:40px;margin-bottom:16px}
      .col{flex:1}
      .label{font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px}
      .value{font-weight:600;font-size:14px}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th{background:#1a1a2e;color:#fff;padding:8px 10px;text-align:left;font-size:11px;text-transform:uppercase}
      td{padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px}
      .total{font-size:16px;font-weight:700;text-align:right;margin-top:16px;color:#1a1a2e}
      .badge{display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600}
      @media print{body{padding:16px}}
    </style></head><body>
    <h2>Factura #${cab?.id || "—"}</h2>
    <div class="sub">Reserva #${cab?.reserva_id || "—"} · Emitida: ${fmtF(cab?.fecha_emision)}</div>
    <div class="row">
      <div class="col"><div class="label">Huésped</div><div class="value">${cab?.huesped_nombre || "—"}</div></div>
      <div class="col"><div class="label">Habitación</div><div class="value">Hab. ${cab?.habitacion_numero || "—"} — ${cab?.habitacion_tipo || "—"}</div></div>
      <div class="col"><div class="label">Estadía</div><div class="value">${fmtF(cab?.fecha_inicio)} → ${fmtF(cab?.fecha_fin)}</div></div>
      <div class="col"><div class="label">Plan</div><div class="value">${cab?.plan || "—"}</div></div>
    </div>
    <table>
      <thead><tr><th>#</th><th>Concepto</th><th>Cantidad</th><th>V. Unitario</th><th>Total</th></tr></thead>
      <tbody>
      ${detalle.map((d, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${d.concepto || d.descripcion || "—"}</td>
          <td>${d.cantidad ?? 1}</td>
          <td>${Number(d.valor_unitario ?? 0).toLocaleString("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 })}</td>
          <td>${Number(d.total_linea ?? d.valor_total ?? 0).toLocaleString("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 })}</td>
        </tr>`).join("")}
      </tbody>
    </table>
    <div class="total">Total: ${Number(cab?.total || 0).toLocaleString("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 })}</div>
    <div style="margin-top:32px;font-size:11px;color:#6b7280;text-align:center">
      Gracias por su preferencia · Hotel Manager · ${dayjs().format("DD/MM/YYYY HH:mm")}
    </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); }, 500);
  };

  // ── Anular factura ──────────────────────────────────────────────────────────
  const abrirAnular = (id) => { setAnulandoId(id); setMotivoAnular(""); setShowAnular(true); };
  const confirmarAnular = async () => {
    setGuardandoAnul(true);
    try {
      await axios.put(`${API}/api/facturacion/facturas/${anulandoId}/anular`,
        { motivo: motivoAnular }, getAuth()
      );
      setShowAnular(false);
      cerrarModal();
      await cargarFacturas();
    } catch (e) {
      alert(e.response?.data?.message || "Error al anular la factura.");
    } finally { setGuardandoAnul(false); }
  };

  // ── Excel export ────────────────────────────────────────────────────────────
  const exportarFacturasExcel = () => {
    const filas = facturas.map(f => ({
      "ID": f.id,
      "Reserva": f.reserva_id,
      "Huésped": f.huesped_nombre,
      "Habitación": f.habitacion_numero ? `Hab. ${f.habitacion_numero} - ${f.habitacion_tipo}` : "—",
      "Ingreso": fmtF(f.fecha_inicio),
      "Salida": fmtF(f.fecha_fin),
      "Emisión": fmtF(f.fecha_emision),
      "Total": Number(f.total),
      "Estado": f.estado,
      "Estado Pago": f.estado_pago,
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturas");
    XLSX.writeFile(wb, `facturas_${dayjs().format("YYYY-MM-DD")}.xlsx`);
  };

  const exportarPagosExcel = () => {
    const filas = pagos.map(p => ({
      "ID": p.id,
      "Reserva": p.reserva_id,
      "Huésped": p.huesped_nombre,
      "Habitación": p.habitacion_numero ? `Hab. ${p.habitacion_numero}` : "—",
      "Fecha": fmtFH(p.created_at),
      "Tipo": p.tipo,
      "Método": p.metodo,
      "Referencia": p.referencia || "",
      "Monto": Number(p.monto),
    }));
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos");
    XLSX.writeFile(wb, `pagos_${dayjs().format("YYYY-MM-DD")}.xlsx`);
  };

  const cab = facturaSel?.cabecera ? facturaSel.cabecera : facturaSel;
  const detalleFactura = facturaSel?.detalle || [];
  const puedeAnular = cab && cab.estado !== "anulada";

  return (
    <div>
      <h2 className="mb-3">Facturación y Pagos</h2>

      {/* ── Filtros ── */}
      <Card className="mb-3">
        <Card.Body>
          <Row className="g-2 align-items-end">
            <Col xs={6} md={2}>
              <Form.Label>Desde</Form.Label>
              <Form.Control type="date" value={desde} onChange={e => setDesde(e.target.value)} />
            </Col>
            <Col xs={6} md={2}>
              <Form.Label>Hasta</Form.Label>
              <Form.Control type="date" value={hasta} onChange={e => setHasta(e.target.value)} />
            </Col>
            {tab === "facturas" && (
              <Col xs={6} md={2}>
                <Form.Label>Estado factura</Form.Label>
                <Form.Select value={fEstado} onChange={e => setFEstado(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="emitida">Emitida</option>
                  <option value="anulada">Anulada</option>
                </Form.Select>
              </Col>
            )}
            {tab === "pagos" && (<>
              <Col xs={6} md={2}>
                <Form.Label>Tipo movimiento</Form.Label>
                <Form.Select value={pTipo} onChange={e => setPTipo(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="pago">Pago</option>
                  <option value="deposito">Depósito</option>
                  <option value="cargo">Cargo</option>
                </Form.Select>
              </Col>
              <Col xs={6} md={2}>
                <Form.Label>Método de pago</Form.Label>
                <Form.Select value={pMetodo} onChange={e => setPMetodo(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="transferencia">Transferencia</option>
                  <option value="nequi">Nequi</option>
                  <option value="daviplata">Daviplata</option>
                </Form.Select>
              </Col>
            </>)}
            <Col xs={12} md="auto" className="d-flex gap-2">
              <Button variant="primary" onClick={aplicarFiltros}>Filtrar</Button>
              <Button variant="outline-secondary" onClick={() => {
                setDesde(""); setHasta(""); setFEstado(""); setPMetodo(""); setPTipo("");
                setTimeout(() => { cargarFacturas(); cargarPagos(); }, 0);
              }}>Limpiar</Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Tabs activeKey={tab} onSelect={k => setTab(k || "facturas")} className="mb-3">

        {/* ── Tab Facturas ── */}
        <Tab eventKey="facturas" title={`Facturas (${facturas.length})`}>
          <Card>
            <Card.Body>
              <div className="d-flex justify-content-end mb-2 gap-2">
                <Button size="sm" variant="outline-success" onClick={exportarFacturasExcel}
                  disabled={!facturas.length}>
                  Exportar Excel
                </Button>
              </div>
              <Table striped bordered hover responsive size="sm">
                <thead>
                  <tr>
                    <th>#</th><th>Reserva</th><th>Huésped</th><th>Habitación</th>
                    <th>Ingreso</th><th>Salida</th><th>Emisión</th>
                    <th>Total</th><th>Estado</th><th>Pago</th><th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.length === 0 && (
                    <tr><td colSpan={11} className="text-center text-muted">Sin facturas en el rango.</td></tr>
                  )}
                  {facturas.map(f => (
                    <tr key={f.id}>
                      <td>{f.id}</td>
                      <td>{f.reserva_id}</td>
                      <td>{f.huesped_nombre || "—"}</td>
                      <td>{f.habitacion_numero ? `Hab. ${f.habitacion_numero} — ${f.habitacion_tipo}` : "—"}</td>
                      <td>{fmtF(f.fecha_inicio)}</td>
                      <td>{fmtF(f.fecha_fin)}</td>
                      <td>{fmtF(f.fecha_emision)}</td>
                      <td className="fw-semibold">{fmtMon(f.total)}</td>
                      <td>
                        <Badge bg={f.estado === "anulada" ? "secondary" : "dark"}>
                          {f.estado || "emitida"}
                        </Badge>
                      </td>
                      <td>
                        <Badge bg={ESTADO_PAGO_COLOR[f.estado_pago] || "secondary"}>
                          {f.estado_pago || "—"}
                        </Badge>
                      </td>
                      <td className="d-flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline-primary" onClick={() => abrirFactura(f.id)}>
                          Ver / Imprimir
                        </Button>
                        {f.estado !== "anulada" && (
                          <Button size="sm" variant="outline-danger" onClick={() => abrirAnular(f.id)}>
                            Anular
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        {/* ── Tab Pagos ── */}
        <Tab eventKey="pagos" title={`Pagos / Depósitos / Cargos (${pagos.length})`}>
          <Card>
            <Card.Body>
              <div className="d-flex justify-content-end mb-2 gap-2">
                <Button size="sm" variant="outline-success" onClick={exportarPagosExcel}
                  disabled={!pagos.length}>
                  Exportar Excel
                </Button>
              </div>
              <Table striped bordered hover responsive size="sm">
                <thead>
                  <tr>
                    <th>#</th><th>Reserva</th><th>Huésped</th><th>Habitación</th>
                    <th>Fecha</th><th>Tipo</th><th>Método</th><th>Descripción</th><th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.length === 0 && (
                    <tr><td colSpan={9} className="text-center text-muted">Sin movimientos en el rango.</td></tr>
                  )}
                  {pagos.map(p => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.reserva_id || "—"}</td>
                      <td>{p.huesped_nombre || "—"}</td>
                      <td>{p.habitacion_numero ? `Hab. ${p.habitacion_numero}` : "—"}</td>
                      <td>{fmtFH(p.created_at)}</td>
                      <td>
                        <Badge bg={p.tipo === "pago" ? "success" : p.tipo === "cargo" ? "danger" : "info"}>
                          {p.tipo}
                        </Badge>
                      </td>
                      <td>{p.metodo || "—"}</td>
                      <td>{p.referencia || "—"}</td>
                      <td className="fw-semibold">{fmtMon(p.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* ── Modal ver / imprimir factura ── */}
      <Modal show={showFacturaModal} onHide={cerrarModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Factura #{cab?.id || "—"} — Reserva {cab?.reserva_id || "—"}
            {cab?.estado === "anulada" && (
              <Badge bg="secondary" className="ms-2">ANULADA</Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body ref={printRef}>
          {cargandoFactura && (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" /> Cargando...
            </div>
          )}
          {!cargandoFactura && cab && (<>
            <Row className="mb-3">
              <Col md={6}>
                <div className="text-muted" style={{ fontSize: 11 }}>HUÉSPED</div>
                <div className="fw-semibold">{cab.huesped_nombre || "—"}</div>
              </Col>
              <Col md={6}>
                <div className="text-muted" style={{ fontSize: 11 }}>HABITACIÓN</div>
                <div className="fw-semibold">
                  {cab.habitacion_numero ? `Hab. ${cab.habitacion_numero} — ${cab.habitacion_tipo}` : "—"}
                </div>
              </Col>
              <Col md={4} className="mt-2">
                <div className="text-muted" style={{ fontSize: 11 }}>ESTADÍA</div>
                <div>{fmtF(cab.fecha_inicio)} → {fmtF(cab.fecha_fin)}</div>
              </Col>
              <Col md={4} className="mt-2">
                <div className="text-muted" style={{ fontSize: 11 }}>EMISIÓN</div>
                <div>{fmtF(cab.fecha_emision)}</div>
              </Col>
              <Col md={4} className="mt-2">
                <div className="text-muted" style={{ fontSize: 11 }}>PLAN</div>
                <div>{cab.plan || "—"}</div>
              </Col>
            </Row>
            <hr />
            <Table striped bordered size="sm">
              <thead>
                <tr><th>#</th><th>Concepto</th><th>Cant.</th><th>V. Unitario</th><th>Total línea</th></tr>
              </thead>
              <tbody>
                {detalleFactura.length === 0 && (
                  <tr><td colSpan={5} className="text-center text-muted">Sin detalle.</td></tr>
                )}
                {detalleFactura.map((d, i) => (
                  <tr key={d.id}>
                    <td>{i + 1}</td>
                    <td>{d.concepto || d.descripcion || "—"}</td>
                    <td>{d.cantidad ?? 1}</td>
                    <td>{fmtMon(d.valor_unitario ?? 0)}</td>
                    <td>{fmtMon(d.total_linea ?? d.valor_total ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="text-end fw-bold fs-5 mt-2">
              Total: {fmtMon(cab.total)}
            </div>
          </>)}
        </Modal.Body>
        <Modal.Footer>
          {puedeAnular && (
            <Button variant="outline-danger" onClick={() => { cerrarModal(); abrirAnular(cab.id); }}>
              Anular factura
            </Button>
          )}
          <Button variant="outline-primary" onClick={imprimirFactura} disabled={!cab}>
            Imprimir / PDF
          </Button>
          <Button variant="secondary" onClick={cerrarModal}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      {/* ── Modal anular ── */}
      <Modal show={showAnular} onHide={() => setShowAnular(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Anular Factura #{anulandoId}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-danger fw-semibold">
            Esta acción anulará la factura permanentemente. La reserva podrá volver a facturarse.
          </p>
          <Form.Label>Motivo de anulación (opcional)</Form.Label>
          <Form.Control
            as="textarea" rows={2}
            value={motivoAnular}
            onChange={e => setMotivoAnular(e.target.value)}
            placeholder="Ej: Error en los datos del huésped"
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowAnular(false)} disabled={guardandoAnul}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmarAnular} disabled={guardandoAnul}>
            {guardandoAnul ? <><Spinner animation="border" size="sm" className="me-1" />Anulando...</> : "Confirmar anulación"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
