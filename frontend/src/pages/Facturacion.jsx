// src/pages/Facturacion.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import {
  Button,
  Card,
  Col,
  Form,
  Modal,
  Row,
  Table,
  Tabs,
  Tab,
  Spinner,
} from "react-bootstrap";

export default function Facturacion() {
  const [facturas, setFacturas] = useState([]);
  const [pagos, setPagos] = useState([]);

  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [tab, setTab] = useState("facturas");

  const [facturaSel, setFacturaSel] = useState(null);
  const [showFacturaModal, setShowFacturaModal] = useState(false);
  const [cargandoFactura, setCargandoFactura] = useState(false);

  const token = localStorage.getItem("token");

  const axiosConfig = token
    ? { headers: { Authorization: `Bearer ${token}` } }
    : {};

  const cargarFacturas = async () => {
    try {
      const params = {};
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;

      const r = await axios.get("http://localhost:4000/api/facturas", {
        params,
        ...axiosConfig,
      });

      setFacturas(r.data || []);
    } catch (e) {
      console.error("Error cargando facturas:", e);
      alert("No se pudieron cargar las facturas.");
    }
  };

  const cargarPagos = async () => {
    try {
      const params = {};
      if (desde) params.desde = desde;
      if (hasta) params.hasta = hasta;

      const r = await axios.get("http://localhost:4000/api/pagos", {
        params,
        ...axiosConfig,
      });

      setPagos(r.data || []);
    } catch (e) {
      console.error("Error cargando pagos:", e);
      alert("No se pudieron cargar los pagos.");
    }
  };

  useEffect(() => {
    cargarFacturas();
    cargarPagos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aplicarFiltros = async () => {
    await Promise.all([cargarFacturas(), cargarPagos()]);
  };

  // ✅ Obtiene factura completa para modal (cabecera + detalle) o plana (según backend)
  const abrirFactura = async (facturaId) => {
    try {
      setShowFacturaModal(true);
      setCargandoFactura(true);
      setFacturaSel(null);

      const r = await axios.get(
        `http://localhost:4000/api/facturas/${facturaId}`,
        axiosConfig
      );

      setFacturaSel(r.data);
    } catch (e) {
      console.error("Error obteniendo factura:", e);
      alert(e.response?.data?.message || "No se pudo obtener el detalle de la factura.");
      setShowFacturaModal(false);
      setFacturaSel(null);
    } finally {
      setCargandoFactura(false);
    }
  };

  const cerrarFacturaModal = () => {
    setShowFacturaModal(false);
    setFacturaSel(null);
    setCargandoFactura(false);
  };

  const fmtFecha = (f) => (f ? dayjs(f).format("YYYY-MM-DD") : "—");

  const fmtFechaHora = (f) => (f ? dayjs(f).format("YYYY-MM-DD HH:mm") : "—");

  const fmtMon = (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) return "—";
    return n.toLocaleString("es-CO", { style: "currency", currency: "COP" });
  };

  // ✅ Soporta ambos formatos: {cabecera:{...}, detalle:[]} o factura plana {..., detalle:[]}
  const cab = facturaSel?.cabecera ? facturaSel.cabecera : facturaSel;

  const detalleFactura = facturaSel?.detalle || [];

  return (
    <div>
      <h2 className="mb-3">📄 Facturación y Pagos</h2>

      <Card className="mb-3">
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col xs={12} md={3}>
              <Form.Label>Desde</Form.Label>
              <Form.Control
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </Col>
            <Col xs={12} md={3}>
              <Form.Label>Hasta</Form.Label>
              <Form.Control
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </Col>
            <Col xs={12} md={3}>
              <Button variant="primary" onClick={aplicarFiltros}>
                Aplicar filtros
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Tabs
        activeKey={tab}
        onSelect={(k) => setTab(k || "facturas")}
        className="mb-3"
      >
        <Tab eventKey="facturas" title="Facturas">
          <Card>
            <Card.Body>
              <Table striped bordered hover responsive size="sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Reserva</th>
                    <th>Huésped</th>
                    <th>Habitación</th>
                    <th>Ingreso</th>
                    <th>Salida</th>
                    <th>Fecha emisión</th>
                    <th>Total</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {facturas.length === 0 && (
                    <tr>
                      <td colSpan={10} className="text-center text-muted">
                        No hay facturas registradas en el rango seleccionado.
                      </td>
                    </tr>
                  )}
                  {facturas.map((f) => (
                    <tr key={f.id}>
                      <td>{f.id}</td>
                      <td>{f.reserva_id}</td>
                      <td>{f.huesped_nombre || "—"}</td>
                      <td>
                        {f.habitacion_numero
                          ? `Hab. ${f.habitacion_numero} — ${f.habitacion_tipo || "—"}`
                          : "—"}
                      </td>
                      <td>{fmtFecha(f.fecha_inicio)}</td>
                      <td>{fmtFecha(f.fecha_fin)}</td>
                      <td>{fmtFecha(f.fecha_emision)}</td>
                      <td>{fmtMon(f.total)}</td>
                      <td>
                        <span className="badge bg-secondary">
                          {f.estado || "emitida"}
                        </span>
                      </td>
                      <td>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          onClick={() => abrirFactura(f.id)}
                        >
                          Ver / reimprimir
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>

        <Tab eventKey="pagos" title="Pagos / depósitos / cargos">
          <Card>
            <Card.Body>
              <Table striped bordered hover responsive size="sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Reserva</th>
                    <th>Huésped</th>
                    <th>Habitación</th>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Método</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {pagos.length === 0 && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted">
                        No hay pagos registrados en el rango seleccionado.
                      </td>
                    </tr>
                  )}
                  {pagos.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.reserva_id || "—"}</td>
                      <td>{p.huesped_nombre || "—"}</td>
                      <td>
                        {p.habitacion_numero
                          ? `Hab. ${p.habitacion_numero} — ${p.habitacion_tipo || "—"}`
                          : "—"}
                      </td>
                      <td>{fmtFechaHora(p.fecha || p.created_at)}</td>
                      <td>{p.tipo || "—"}</td>
                      <td>{p.metodo || "—"}</td>
                      <td>{p.descripcion || p.referencia || "—"}</td>
                      <td>{fmtMon(p.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Tab>
      </Tabs>

      {/* ✅ Modal ver factura */}
      <Modal
        show={showFacturaModal}
        onHide={cerrarFacturaModal}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            Factura #{cab?.id || "—"} — Reserva {cab?.reserva_id || "—"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {cargandoFactura && (
            <div className="d-flex align-items-center gap-2">
              <Spinner animation="border" size="sm" />
              <span>Cargando información de la factura...</span>
            </div>
          )}

          {!cargandoFactura && !cab && (
            <p className="text-muted">No se pudo cargar la factura.</p>
          )}

          {!cargandoFactura && cab && (
            <>
              <p className="mb-1">
                <strong>Huésped:</strong> {cab.huesped_nombre || "—"}
              </p>
              <p className="mb-1">
                <strong>Habitación:</strong>{" "}
                {cab.habitacion_numero
                  ? `Hab. ${cab.habitacion_numero} — ${cab.habitacion_tipo || "—"}`
                  : "—"}
              </p>
              <p className="mb-1">
                <strong>Estadía:</strong> {fmtFecha(cab.fecha_inicio)} →{" "}
                {fmtFecha(cab.fecha_fin)}
              </p>
              <p className="mb-1">
                <strong>Fecha emisión:</strong> {fmtFecha(cab.fecha_emision)}
              </p>
              <p className="mb-3">
                <strong>Estado:</strong> {cab.estado || "emitida"}
              </p>

              <hr />

              {/* Si tu backend no tiene estos totales, se muestran como 0 */}
              <p className="mb-1">
                <strong>Total alojamiento:</strong>{" "}
                {fmtMon(cab.total_alojamiento || 0)}
              </p>
              <p className="mb-1">
                <strong>Total cargos:</strong> {fmtMon(cab.total_cargos || 0)}
              </p>
              <p className="mb-1">
                <strong>Total pagado:</strong> {fmtMon(cab.total_pagado || 0)}
              </p>
              <p className="mb-1">
                <strong>Total factura:</strong> {fmtMon(cab.total || 0)}
              </p>

              <hr />

              <h6>Detalle de conceptos</h6>
              <Table striped bordered hover responsive size="sm">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Concepto</th>
                    <th>Cant.</th>
                    <th>V. unitario</th>
                    <th>Total línea</th>
                  </tr>
                </thead>
                <tbody>
                  {(!detalleFactura || detalleFactura.length === 0) && (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No hay detalle de factura.
                      </td>
                    </tr>
                  )}

                  {detalleFactura.map((d) => {
                    const concepto = d.concepto || d.descripcion || "—";
                    const cantidad = d.cantidad ?? 1;
                    const vu = d.valor_unitario ?? 0;
                    const vt = d.total_linea ?? d.valor_total ?? 0;

                    return (
                      <tr key={d.id}>
                        <td>{d.id}</td>
                        <td>{concepto}</td>
                        <td>{cantidad}</td>
                        <td>{fmtMon(vu)}</td>
                        <td>{fmtMon(vt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarFacturaModal}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
