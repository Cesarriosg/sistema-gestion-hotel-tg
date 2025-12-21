// src/pages/DetalleReserva.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import { Row, Col, Card, Table, Badge, Form, Button, Spinner } from "react-bootstrap";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const money = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
};

export default function DetalleReserva() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [reserva, setReserva] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [factura, setFactura] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // Form pago / depósito
  const [tipoPago, setTipoPago] = useState("deposito"); // deposito | pago
  const [medioPago, setMedioPago] = useState("efectivo");
  const [monto, setMonto] = useState("");
  const [descripcionPago, setDescripcionPago] = useState("");
  const [guardandoPago, setGuardandoPago] = useState(false);

  // Facturación / checkout
  const [generandoFactura, setGenerandoFactura] = useState(false);
  const [haciendoCheckout, setHaciendoCheckout] = useState(false);

  // Cargos
  const [guardandoCargo, setGuardandoCargo] = useState(false);
  const [descCargo, setDescCargo] = useState("");
  const [cantCargo, setCantCargo] = useState(1);
  const [valorCargo, setValorCargo] = useState("");

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError("");

      const res = await axios.get(
        `http://localhost:4000/api/reservas/${id}/finanzas`,
        { headers: getAuthHeaders() }
      );

      const data = res.data;
      setReserva(data.reserva);
      setPagos(data.pagos || []);
      setFactura(data.factura || null);
      setDetalles(data.detalles || []);
      setResumen(data.resumen || null);
    } catch (e) {
      console.error("Error cargando finanzas:", e);
      setError("Error al cargar la información de la reserva.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const registrarPago = async (e) => {
    e.preventDefault();

    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      alert("El monto debe ser mayor a cero.");
      return;
    }

    // ✅ Regla UI: depósito solo si reserva está "reservada"
    if (tipoPago === "deposito" && reserva?.estado !== "reservada") {
      alert("Depósito solo permitido cuando la reserva está 'reservada'. Si está 'ocupada', registra un PAGO.");
      return;
    }

    // ✅ Regla UI: pago solo si reserva está "ocupada"
    if (tipoPago === "pago" && reserva?.estado !== "ocupada") {
      alert("Pago solo permitido cuando la reserva está 'ocupada'. Si aún está 'reservada', registra un DEPÓSITO.");
      return;
    }

    try {
      setGuardandoPago(true);

      // Enviamos el formato que tu backend (crearPago) entiende:
      await axios.post(
        "http://localhost:4000/api/pagos",
        {
          reserva_id: Number(id),
          tipo: tipoPago,
          metodo: medioPago,
          monto: montoNum,
          referencia: descripcionPago || null, // 👈 backend guarda en "referencia"
        },
        { headers: getAuthHeaders() }
      );

      setMonto("");
      setDescripcionPago("");
      await cargarDatos();
    } catch (e) {
      console.error("Error registrando pago:", e);
      alert(e.response?.data?.message || "No se pudo registrar el pago / depósito.");
    } finally {
      setGuardandoPago(false);
    }
  };

  const generarFactura = async () => {
    if (!reserva) return;

    if (factura) {
      alert("La reserva ya tiene una factura generada.");
      return;
    }

    if (!resumen || Number(resumen.total_pagado) <= 0) {
      alert("Registra al menos un depósito/pago antes de facturar.");
      return;
    }

    try {
      setGenerandoFactura(true);
      await axios.post(
        `http://localhost:4000/api/reservas/${id}/facturar`,
        {},
        { headers: getAuthHeaders() }
      );
      await cargarDatos();
    } catch (e) {
      console.error("Error facturando:", e);
      alert(e.response?.data?.message || "No se pudo generar la factura.");
    } finally {
      setGenerandoFactura(false);
    }
  };

  const hacerCheckout = async () => {
    if (!reserva) return;

    if (!factura) {
      alert("No se puede hacer check-out sin factura.");
      return;
    }

    if (!window.confirm("¿Confirmar check-out de esta reserva?")) return;

    try {
      setHaciendoCheckout(true);
      await axios.post(
        `http://localhost:4000/api/reservas/${id}/checkout`,
        {},
        { headers: getAuthHeaders() }
      );
      await cargarDatos();
      alert("Check-out realizado correctamente.");
    } catch (e) {
      console.error("Error en check-out:", e);
      alert(e.response?.data?.message || "No se pudo realizar el check-out.");
    } finally {
      setHaciendoCheckout(false);
    }
  };

  const registrarCargo = async (e) => {
    e.preventDefault();

    if (!factura) {
      alert("La reserva aún no tiene factura.");
      return;
    }

    if (!descCargo || !valorCargo || Number(cantCargo) <= 0) {
      alert("Completa la descripción, cantidad y valor unitario.");
      return;
    }

    try {
      setGuardandoCargo(true);
      await axios.post(
        `http://localhost:4000/api/reservas/${id}/factura/cargos`,
        {
          descripcion: descCargo,
          cantidad: Number(cantCargo),
          valor_unitario: Number(valorCargo),
        },
        { headers: getAuthHeaders() }
      );

      setDescCargo("");
      setCantCargo(1);
      setValorCargo("");
      await cargarDatos();
    } catch (e) {
      console.error("Error registrando cargo adicional:", e);
      alert(e.response?.data?.message || "No se pudo registrar el cargo adicional.");
    } finally {
      setGuardandoCargo(false);
    }
  };

  const estado = reserva?.estado;
  const esReservada = estado === "reservada";
  const esOcupada = estado === "ocupada";
  const esFinalizada = estado === "finalizada";

  const puedeFacturar = esOcupada && resumen && Number(resumen.total_pagado) > 0 && !factura;
  const puedeCheckout = esOcupada && factura;

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">📄 Detalle de reserva #{id}</h3>
        <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>

      {error && <div className="alert alert-danger py-2 mb-3">{error}</div>}

      {cargando && (
        <div className="d-flex align-items-center mb-3">
          <Spinner animation="border" size="sm" className="me-2" />
          <span>Cargando información financiera...</span>
        </div>
      )}

      {!reserva ? (
        !cargando && <p className="text-muted">No se encontró información de la reserva.</p>
      ) : (
        <>
          <Row className="mb-3">
            <Col md={6}>
              <Card>
                <Card.Body>
                  <Card.Title>Información de la reserva</Card.Title>
                  <p className="mb-1">
                    <strong>Huésped:</strong> {reserva.huesped_nombre || "—"}
                  </p>
                  <p className="mb-1">
                    <strong>Habitación:</strong> {reserva.habitacion_numero} ({reserva.habitacion_tipo})
                  </p>
                  <p className="mb-1">
                    <strong>Fechas:</strong> {dayjs(reserva.fecha_inicio).format("YYYY-MM-DD")} →{" "}
                    {dayjs(reserva.fecha_fin).format("YYYY-MM-DD")}
                  </p>
                  <p className="mb-1">
                    <strong>Estado:</strong>{" "}
                    <Badge bg={esReservada ? "info" : esOcupada ? "success" : esFinalizada ? "secondary" : "dark"}>
                      {reserva.estado}
                    </Badge>
                  </p>
                  {reserva.notas && (
                    <p className="mb-1">
                      <strong>Notas:</strong> {reserva.notas}
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col md={6}>
              <Card>
                <Card.Body>
                  <Card.Title>Resumen financiero</Card.Title>

                  {resumen ? (
                    <Table size="sm" borderless className="mb-2">
                      <tbody>
                        <tr>
                          <td>Total depósitos:</td>
                          <td className="text-end">${money(resumen.total_depositos)}</td>
                        </tr>
                        <tr>
                          <td>Total pagos:</td>
                          <td className="text-end">${money(resumen.total_pagos)}</td>
                        </tr>
                        <tr>
                          <td><strong>Total pagado:</strong></td>
                          <td className="text-end"><strong>${money(resumen.total_pagado)}</strong></td>
                        </tr>
                        <tr>
                          <td>Total facturado:</td>
                          <td className="text-end">${money(resumen.total_facturado)}</td>
                        </tr>
                        <tr>
                          <td><strong>Saldo:</strong></td>
                          <td className={`text-end ${Number(resumen.saldo) > 0 ? "text-danger" : "text-success"}`}>
                            <strong>${money(resumen.saldo)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  ) : (
                    <p className="text-muted">No hay resumen financiero disponible.</p>
                  )}

                  <hr />

                  <Card.Subtitle className="mb-2">Factura</Card.Subtitle>

                  {factura ? (
                    <>
                      <p className="mb-1"><strong>ID Factura:</strong> {factura.id || factura.numero || "—"}</p>
                      <p className="mb-1">
                        <strong>Fecha emisión:</strong>{" "}
                        {factura.fecha_emision ? dayjs(factura.fecha_emision).format("YYYY-MM-DD") : "—"}
                      </p>
                      <p className="mb-2"><strong>Estado:</strong> {factura.estado || "—"}</p>

                      <div className="mt-2">
                        <strong>Detalles de la factura</strong>
                        <div className="table-responsive">
                          <Table size="sm" bordered className="mt-1">
                            <thead>
                              <tr>
                                <th>Descripción</th>
                                <th>Cant.</th>
                                <th>V. unitario</th>
                                <th>V. total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(!detalles || detalles.length === 0) ? (
                                <tr>
                                  <td colSpan={4} className="text-center text-muted">
                                    No hay detalles de factura registrados.
                                  </td>
                                </tr>
                              ) : (
                                detalles.map((d) => (
                                  <tr key={d.id}>
                                    <td>{d.descripcion || d.concepto || "—"}</td>
                                    <td>{d.cantidad}</td>
                                    <td>${money(d.valor_unitario)}</td>
                                    <td>${money(d.valor_total)}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </Table>
                        </div>
                      </div>

                      {puedeCheckout && (
                        <Button className="mt-2" variant="dark" onClick={hacerCheckout} disabled={haciendoCheckout}>
                          {haciendoCheckout ? "Realizando check-out..." : "✅ Confirmar Check-Out final"}
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-muted">No se ha generado factura para esta reserva.</p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={generarFactura}
                        disabled={!puedeFacturar || generandoFactura}
                      >
                        {generandoFactura ? "Generando factura..." : "Generar factura"}
                      </Button>
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col md={7} className="mb-3">
              <Card>
                <Card.Body>
                  <Card.Title>Pagos y depósitos</Card.Title>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Tipo</th>
                          <th>Método</th>
                          <th>Monto</th>
                          <th>Descripción</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagos.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center text-muted">
                              No hay pagos ni depósitos registrados.
                            </td>
                          </tr>
                        ) : (
                          pagos.map((p) => (
                            <tr key={p.id}>
                              <td>{p.created_at ? dayjs(p.created_at).format("YYYY-MM-DD HH:mm") : "—"}</td>
                              <td>{p.tipo || "—"}</td>
                              <td>{p.metodo || "—"}</td>
                              <td>${money(p.monto)}</td>
                              <td>{p.referencia || "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            <Col md={5} className="mb-3">
              <Card>
                <Card.Body>
                  <Card.Title>Registrar pago / depósito</Card.Title>

                  <Form onSubmit={registrarPago}>
                    <Row className="mb-2">
                      <Col>
                        <Form.Label>Tipo</Form.Label>
                        <Form.Select
                          value={tipoPago}
                          onChange={(e) => setTipoPago(e.target.value)}
                          size="sm"
                        >
                          <option value="deposito" disabled={!esReservada}>
                            Depósito {(!esReservada ? "(solo en reservada)" : "")}
                          </option>
                          <option value="pago" disabled={!esOcupada}>
                            Pago {(!esOcupada ? "(solo en ocupada)" : "")}
                          </option>
                        </Form.Select>
                      </Col>

                      <Col>
                        <Form.Label>Método</Form.Label>
                        <Form.Select
                          value={medioPago}
                          onChange={(e) => setMedioPago(e.target.value)}
                          size="sm"
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="tarjeta">Tarjeta</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="otro">Otro</option>
                        </Form.Select>
                      </Col>
                    </Row>

                    <Form.Group className="mb-2">
                      <Form.Label>Monto</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        value={monto}
                        onChange={(e) => setMonto(e.target.value)}
                        size="sm"
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Descripción (opcional)</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={2}
                        value={descripcionPago}
                        onChange={(e) => setDescripcionPago(e.target.value)}
                        size="sm"
                      />
                    </Form.Group>

                    <Button type="submit" variant="success" size="sm" disabled={guardandoPago}>
                      {guardandoPago ? "Guardando..." : "Registrar"}
                    </Button>
                  </Form>

                  <hr className="mt-4 mb-3" />

                  <h6>Cargos adicionales sobre la factura</h6>
                  <p className="text-muted" style={{ fontSize: 12 }}>
                    Solo disponibles cuando la reserva está ocupada y ya tiene factura.
                  </p>

                  <Form onSubmit={registrarCargo}>
                    <Form.Group className="mb-2">
                      <Form.Label>Descripción del cargo</Form.Label>
                      <Form.Control
                        value={descCargo}
                        onChange={(e) => setDescCargo(e.target.value)}
                        disabled={!factura || !esOcupada}
                        required
                        size="sm"
                      />
                    </Form.Group>

                    <Form.Group className="mb-2">
                      <Form.Label>Cantidad</Form.Label>
                      <Form.Control
                        type="number"
                        min="1"
                        value={cantCargo}
                        onChange={(e) => setCantCargo(e.target.value)}
                        disabled={!factura || !esOcupada}
                        required
                        size="sm"
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Valor unitario</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        value={valorCargo}
                        onChange={(e) => setValorCargo(e.target.value)}
                        disabled={!factura || !esOcupada}
                        required
                        size="sm"
                      />
                    </Form.Group>

                    <Button
                      type="submit"
                      variant="warning"
                      size="sm"
                      disabled={!factura || !esOcupada || guardandoCargo}
                    >
                      {guardandoCargo ? "Guardando..." : "Agregar cargo"}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
}
