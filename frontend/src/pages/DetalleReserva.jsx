
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import {
  Row,
  Col,
  Card,
  Table,
  Badge,
  Form,
  Button,
  Spinner,
  Alert,
  Modal,
} from "react-bootstrap";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const safeJson = (v) => {
  if (!v) return null;
  if (typeof v === "object") return v; 
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
};

const planLabel = (p) => {
  const x = (p || "").toUpperCase();
  if (x === "GK") return "Gold King (GK)";
  if (x === "C1") return "Clásico 1 (C1)";
  return p || "—";
};

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("es-CO");
};

const TIPOS_DOC = [
  { value: "", label: "Seleccione..." },
  { value: "CC", label: "CC" },
  { value: "CE", label: "CE" },
  { value: "PA", label: "Pasaporte" },
  { value: "TI", label: "TI" },
  { value: "NIT", label: "NIT" },
];

export default function DetalleReserva() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [reserva, setReserva] = useState(null);
  const [pagos, setPagos] = useState([]);
  const [factura, setFactura] = useState(null);
  const [detalles, setDetalles] = useState([]);
  const [resumen, setResumen] = useState(null);

  const [huespedesAsociados, setHuespedesAsociados] = useState([]);
  const [cargandoAsociados, setCargandoAsociados] = useState(false);
  const [errorAsociados, setErrorAsociados] = useState("");

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // Form pago / depósito
  const [tipoPago, setTipoPago] = useState("deposito");
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


  //  Editar huésped

  const [showEditH, setShowEditH] = useState(false);
  const [showConfirmH, setShowConfirmH] = useState(false);
  const [loadingH, setLoadingH] = useState(false);
  const [savingH, setSavingH] = useState(false);
  const [errH, setErrH] = useState("");

  const [formH, setFormH] = useState({
    id: null,
    tipo_documento: "",
    documento: "",
    nombres: "",
    primer_apellido: "",
    segundo_apellido: "",
    telefono: "",
    email: "",
    direccion: "",
    nacionalidad: "",
    ciudad: "",
    fecha_nacimiento: "",
    fecha_expedicion: "",
  });

  
  //  Editar acompañantes
  
  const [showEditA, setShowEditA] = useState(false);
  const [savingA, setSavingA] = useState(false);
  const [errA, setErrA] = useState("");
  const [formA, setFormA] = useState([]); // solo acompañantes

  const cargarAsociados = async () => {
    try {
      setCargandoAsociados(true);
      setErrorAsociados("");
      const r = await axios.get(`${API}/api/reservas/${id}/huespedes-asociados`, {
        headers: getAuthHeaders(),
      });
      setHuespedesAsociados(r.data || []);
    } catch (e) {
      setErrorAsociados(e?.response?.data?.message || "No se pudieron cargar los huéspedes asociados.");
    } finally {
      setCargandoAsociados(false);
    }
  };

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError("");

      const res = await axios.get(`${API}/api/reservas/${id}/finanzas`, {
        headers: getAuthHeaders(),
      });

      const data = res.data;
      setReserva(data.reserva);
      setPagos(data.pagos || []);
      setFactura(data.factura || null);
      setDetalles(data.detalles || []);
      setResumen(data.resumen || null);

      //    también cargar asociados
      await cargarAsociados();
    } catch (e) {
      console.error("Error cargando finanzas:", e);
      setError("Error al cargar la información de la reserva.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [id]);

  const registrarPago = async (e) => {
    e.preventDefault();

    const montoNum = Number(monto);
    if (!Number.isFinite(montoNum) || montoNum <= 0) {
      alert("El monto debe ser mayor a cero.");
      return;
    }

    if (tipoPago === "deposito" && reserva?.estado !== "reservada") {
      alert("Depósito solo permitido cuando la reserva está 'reservada'.");
      return;
    }
    if (tipoPago === "pago" && reserva?.estado !== "ocupada") {
      alert("Pago solo permitido cuando la reserva está 'ocupada'.");
      return;
    }

    try {
      setGuardandoPago(true);
      await axios.post(
        `${API}/api/pagos`,
        {
          reserva_id: Number(id),
          tipo: tipoPago,
          metodo: medioPago,
          monto: montoNum,
          referencia: descripcionPago || null,
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
        `${API}/api/facturacion/reservas/${id}/facturar`,
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
      await axios.post(`${API}/api/reservas/${id}/checkout`, {}, { headers: getAuthHeaders() });
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
        `${API}/api/reservas/${id}/factura/cargos`,
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

  // Snapshot (tarifa)
  const snap = useMemo(() => safeJson(reserva?.tarifa_snapshot), [reserva?.tarifa_snapshot]);

  const planMostrar = snap?.plan || reserva?.plan || "—";
  const tipoMostrar = snap?.tipo_habitacion || reserva?.habitacion_tipo || "—";
  const nochesMostrar = snap?.noches ?? null;
  const precioNocheMostrar = snap?.precio_noche ?? null;
  const totalMostrar = snap?.total ?? null;

  
  //    abrir modal editar huésped
  
  const abrirEditarHuesped = async () => {
    setErrH("");

    const huespedId = reserva?.huesped_id;
    if (!huespedId) {
      setErrH("Esta reserva no tiene huésped asociado (huesped_id).");
      return;
    }

    try {
      setLoadingH(true);
      const r = await axios.get(`${API}/api/huespedes/${huespedId}`, {
        headers: getAuthHeaders(),
      });

      setFormH({
        id: r.data.id,
        tipo_documento: r.data.tipo_documento || "",
        documento: r.data.documento || "",
        nombres: r.data.nombres || "",
        primer_apellido: r.data.primer_apellido || "",
        segundo_apellido: r.data.segundo_apellido || "",
        telefono: r.data.telefono || "",
        email: r.data.email || "",
        direccion: r.data.direccion || "",
        nacionalidad: r.data.nacionalidad || "",
        ciudad: r.data.ciudad || "",
        fecha_nacimiento: r.data.fecha_nacimiento ? String(r.data.fecha_nacimiento).slice(0, 10) : "",
        fecha_expedicion: r.data.fecha_expedicion ? String(r.data.fecha_expedicion).slice(0, 10) : "",
      });

      setShowEditH(true);
    } catch (e) {
      setErrH(e?.response?.data?.message || "No se pudo cargar el huésped.");
    } finally {
      setLoadingH(false);
    }
  };

  const solicitarConfirmacionEdicion = () => {
    setErrH("");
    if (!formH.nombres.trim() || !formH.primer_apellido.trim()) {
      setErrH("Nombres y primer apellido son obligatorios.");
      return;
    }
    setShowConfirmH(true);
  };

  const guardarCambiosHuesped = async () => {
    setErrH("");
    try {
      setSavingH(true);

      await axios.put(
        `${API}/api/huespedes/${formH.id}`,
        {
          tipo_documento: formH.tipo_documento || null,
          documento: formH.documento?.trim() || null,
          nombres: formH.nombres.trim(),
          primer_apellido: formH.primer_apellido.trim(),
          segundo_apellido: formH.segundo_apellido?.trim() || null,
          telefono: formH.telefono?.trim() || null,
          email: formH.email?.trim() || null,
          direccion: formH.direccion?.trim() || null,
          nacionalidad: formH.nacionalidad?.trim() || null,
          ciudad: formH.ciudad?.trim() || null,
          fecha_nacimiento: formH.fecha_nacimiento || null,
          fecha_expedicion: formH.fecha_expedicion || null,
        },
        { headers: getAuthHeaders() }
      );

      setShowConfirmH(false);
      setShowEditH(false);

      await cargarDatos();
    } catch (e) {
      setErrH(e?.response?.data?.message || "No se pudieron guardar los cambios.");
    } finally {
      setSavingH(false);
    }
  };

  
  //   acompañantes (modal)
  
  const abrirEditarAcompanantes = () => {
    setErrA("");

    const acomp = (huespedesAsociados || [])
      .filter((x) => (x.rol || "").toLowerCase() === "acompanante")
      .map((x) => ({
        tipo_documento: x.tipo_documento || "",
        documento: x.documento || "",
        nombres: "", // si no lo devuelves, el usuario lo puede completar
        primer_apellido: "",
        segundo_apellido: "",
        telefono: x.telefono || "",
        email: x.email || "",
      }));

    setFormA(acomp);
    setShowEditA(true);
  };

  const agregarFilaAcompanante = () => {
    setFormA((prev) => [
      ...prev,
      {
        tipo_documento: "",
        documento: "",
        nombres: "",
        primer_apellido: "",
        segundo_apellido: "",
        telefono: "",
        email: "",
      },
    ]);
  };

  const quitarFilaAcompanante = (idx) => {
    setFormA((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateFilaAcompanante = (idx, field, value) => {
    setFormA((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
  };

  const guardarAcompanantes = async () => {
    setErrA("");

    try {
      setSavingA(true);

      await axios.put(
        `${API}/api/reservas/${id}/acompanantes`,
        { acompanantes: formA },
        { headers: getAuthHeaders() }
      );

      setShowEditA(false);
      await cargarDatos();
    } catch (e) {
      console.error("guardarAcompanantes error:", e);
      setErrA(e?.response?.data?.message || "No se pudieron guardar los acompañantes.");
    } finally {
      setSavingA(false);
    }
  };

  // render lista asociados
  const titularAsoc = (huespedesAsociados || []).find((x) => (x.rol || "") === "titular") || null;
  const acompAsoc = (huespedesAsociados || []).filter((x) => (x.rol || "") === "acompanante");

  return (
    <div className="container" style={{ maxWidth: 1200, paddingTop: 14, paddingBottom: 24 }}>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div className="d-flex align-items-center gap-2">
          <div style={{ fontSize: 22 }}>📄</div>
          <h3 className="mb-0">Detalle de reserva #{id}</h3>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={() => navigate(-1)}>
          Volver
        </Button>
      </div>

      {error && (
        <Alert variant="danger" className="py-2">
          {error}
        </Alert>
      )}

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
          <Row className="mb-3 g-3">
            <Col md={6}>
              <Card className="shadow-sm">
                <Card.Body>
                  <Card.Title>Información de la reserva</Card.Title>

                  <div className="d-flex justify-content-between">
                    <div>
                      <div className="mb-1">
                        <strong>Huésped:</strong> {reserva.huesped_nombre || "—"}
                      </div>
                      <div className="mb-1">
                        <strong>Habitación:</strong> {reserva.habitacion_numero} ({reserva.habitacion_tipo})
                      </div>
                      <div className="mb-1">
                        <strong>Acomodación:</strong> {tipoMostrar}
                      </div>
                      <div className="mb-1">
                        <strong>Plan:</strong> {planLabel(planMostrar)}
                      </div>
                      <div className="mb-1">
                        <strong>Fechas:</strong>{" "}
                        {dayjs(reserva.fecha_inicio).format("YYYY-MM-DD")} →{" "}
                        {dayjs(reserva.fecha_fin).format("YYYY-MM-DD")}
                      </div>

                      {esOcupada && (
                        <div className="mt-2 d-flex gap-2 align-items-center">
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={abrirEditarHuesped}
                            disabled={loadingH}
                          >
                            {loadingH ? "Cargando..." : "Editar huésped"}
                          </Button>
                        </div>
                      )}

                      {errH && (
                        <Alert variant="danger" className="py-2 mt-2 mb-0">
                          {errH}
                        </Alert>
                      )}
                    </div>

                    <div className="text-end">
                      <div className="mb-2">
                        <Badge bg={esReservada ? "info" : esOcupada ? "success" : esFinalizada ? "secondary" : "dark"}>
                          {reserva.estado}
                        </Badge>
                      </div>

                      <div
                        className="p-2 rounded"
                        style={{ border: "1px solid #e5e7eb", background: "#f8fafc", minWidth: 200 }}
                      >
                        <div className="text-muted" style={{ fontSize: 12 }}>
                          Tarifa (snapshot)
                        </div>
                        {snap ? (
                          <>
                            {nochesMostrar != null && (
                              <div className="d-flex justify-content-between">
                                <div className="text-muted">Noches</div>
                                <div className="fw-semibold">{nochesMostrar}</div>
                              </div>
                            )}
                            {precioNocheMostrar != null && (
                              <div className="d-flex justify-content-between">
                                <div className="text-muted">Por noche</div>
                                <div className="fw-semibold">${money(precioNocheMostrar)}</div>
                              </div>
                            )}
                            {totalMostrar != null && (
                              <>
                                <hr className="my-2" />
                                <div className="d-flex justify-content-between">
                                  <div className="fw-semibold">Total</div>
                                  <div className="fw-bold">${money(totalMostrar)}</div>
                                </div>
                              </>
                            )}
                          </>
                        ) : (
                          <div className="text-muted">— (no guardada)</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {reserva.notas && (
                    <div className="mt-2">
                      <strong>Notas:</strong> {reserva.notas}
                    </div>
                  )}
                </Card.Body>
              </Card>

              {/*    Huéspedes asociados */}
              <Card className="shadow-sm mt-3">
                <Card.Body>
                  <Card.Title className="mb-2 d-flex justify-content-between align-items-center">
                    <span>Huéspedes asociados</span>

                    {esOcupada && (
                      <Button size="sm" variant="outline-primary" onClick={abrirEditarAcompanantes}>
                        Editar acompañantes
                      </Button>
                    )}
                  </Card.Title>

                  {errorAsociados && (
                    <Alert variant="danger" className="py-2">
                      {errorAsociados}
                    </Alert>
                  )}

                  {cargandoAsociados ? (
                    <div className="d-flex align-items-center">
                      <Spinner animation="border" size="sm" className="me-2" />
                      <span>Cargando huéspedes asociados...</span>
                    </div>
                  ) : (huespedesAsociados || []).length === 0 ? (
                    <div className="text-muted">No hay huéspedes asociados a esta reserva.</div>
                  ) : (
                    <>
                      <div className="mb-2">
                        <div className="fw-semibold">Titular</div>
                        <div className="text-muted">
                          {titularAsoc?.nombre_completo || "—"}{" "}
                          {titularAsoc?.tipo_documento && titularAsoc?.documento
                            ? `(${titularAsoc.tipo_documento} ${titularAsoc.documento})`
                            : ""}
                        </div>
                      </div>

                      <hr className="my-2" />

                      <div className="fw-semibold mb-1">Acompañantes</div>
                      {acompAsoc.length === 0 ? (
                        <div className="text-muted">No hay acompañantes registrados.</div>
                      ) : (
                        <ul className="mb-0">
                          {acompAsoc.map((a) => (
                            <li key={a.id}>
                              {a.nombre_completo || "—"}{" "}
                              {a.tipo_documento && a.documento ? `(${a.tipo_documento} ${a.documento})` : ""}
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col md={6}>
              <Card className="shadow-sm">
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
                          {haciendoCheckout ? "Realizando check-out..." : "   Confirmar Check-Out final"}
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

          <Row className="g-3">
            <Col md={7}>
              <Card className="shadow-sm">
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

            <Col md={5}>
              <Card className="shadow-sm">
                <Card.Body>
                  <Card.Title>Registrar pago / depósito</Card.Title>

                  <Form onSubmit={registrarPago}>
                    <Row className="mb-2">
                      <Col>
                        <Form.Label>Tipo</Form.Label>
                        <Form.Select value={tipoPago} onChange={(e) => setTipoPago(e.target.value)} size="sm">
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
                        <Form.Select value={medioPago} onChange={(e) => setMedioPago(e.target.value)} size="sm">
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

                    <Button type="submit" variant="warning" size="sm" disabled={!factura || !esOcupada || guardandoCargo}>
                      {guardandoCargo ? "Guardando..." : "Agregar cargo"}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* ==========================
                 Modal: editar huésped
             ========================== */}
          <Modal show={showEditH} onHide={() => setShowEditH(false)} centered size="lg">
            <Modal.Header closeButton>
              <Modal.Title>Editar datos del huésped</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {errH && <Alert variant="danger" className="py-2">{errH}</Alert>}

              <div className="row g-3">
                <div className="col-md-3">
                  <Form.Label>Tipo doc.</Form.Label>
                  <Form.Select
                    value={formH.tipo_documento}
                    onChange={(e) => setFormH({ ...formH, tipo_documento: e.target.value })}
                  >
                    {TIPOS_DOC.map((x) => (
                      <option key={x.value} value={x.value}>{x.label}</option>
                    ))}
                  </Form.Select>
                </div>

                <div className="col-md-4">
                  <Form.Label>Documento</Form.Label>
                  <Form.Control
                    value={formH.documento}
                    onChange={(e) => setFormH({ ...formH, documento: e.target.value })}
                  />
                </div>

                <div className="col-md-5">
                  <Form.Label>Teléfono</Form.Label>
                  <Form.Control
                    value={formH.telefono}
                    onChange={(e) => setFormH({ ...formH, telefono: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <Form.Label>Nombres *</Form.Label>
                  <Form.Control
                    value={formH.nombres}
                    onChange={(e) => setFormH({ ...formH, nombres: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <Form.Label>Primer apellido *</Form.Label>
                  <Form.Control
                    value={formH.primer_apellido}
                    onChange={(e) => setFormH({ ...formH, primer_apellido: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <Form.Label>Segundo apellido</Form.Label>
                  <Form.Control
                    value={formH.segundo_apellido}
                    onChange={(e) => setFormH({ ...formH, segundo_apellido: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    value={formH.email}
                    onChange={(e) => setFormH({ ...formH, email: e.target.value })}
                  />
                </div>

                <div className="col-md-6">
                  <Form.Label>Dirección</Form.Label>
                  <Form.Control
                    value={formH.direccion}
                    onChange={(e) => setFormH({ ...formH, direccion: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <Form.Label>Nacionalidad</Form.Label>
                  <Form.Control
                    value={formH.nacionalidad}
                    onChange={(e) => setFormH({ ...formH, nacionalidad: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <Form.Label>Ciudad</Form.Label>
                  <Form.Control
                    value={formH.ciudad}
                    onChange={(e) => setFormH({ ...formH, ciudad: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <Form.Label>Fecha nacimiento</Form.Label>
                  <Form.Control
                    type="date"
                    value={formH.fecha_nacimiento}
                    onChange={(e) => setFormH({ ...formH, fecha_nacimiento: e.target.value })}
                  />
                </div>

                <div className="col-md-4">
                  <Form.Label>Fecha expedición</Form.Label>
                  <Form.Control
                    type="date"
                    value={formH.fecha_expedicion}
                    onChange={(e) => setFormH({ ...formH, fecha_expedicion: e.target.value })}
                  />
                </div>
              </div>
            </Modal.Body>

            <Modal.Footer>
              <Button variant="outline-secondary" onClick={() => setShowEditH(false)} disabled={savingH}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={solicitarConfirmacionEdicion} disabled={savingH}>
                Guardar cambios
              </Button>
            </Modal.Footer>
          </Modal>

          {/* ==========================
                 Modal: confirmación editar huésped
             ========================== */}
          <Modal show={showConfirmH} onHide={() => setShowConfirmH(false)} centered>
            <Modal.Header closeButton>
              <Modal.Title>Confirmar edición</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              ¿Seguro que deseas actualizar los datos del huésped? Esto modificará la información en la base de datos.
            </Modal.Body>
            <Modal.Footer>
              <Button variant="outline-secondary" onClick={() => setShowConfirmH(false)} disabled={savingH}>
                No, volver
              </Button>
              <Button variant="warning" onClick={guardarCambiosHuesped} disabled={savingH}>
                {savingH ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Guardando...
                  </>
                ) : (
                  "Sí, actualizar"
                )}
              </Button>
            </Modal.Footer>
          </Modal>

          {/* ==========================
                 Modal: editar acompañantes
             ========================== */}
          <Modal show={showEditA} onHide={() => setShowEditA(false)} centered size="lg">
            <Modal.Header closeButton>
              <Modal.Title>Editar acompañantes</Modal.Title>
            </Modal.Header>

            <Modal.Body>
              {errA && <Alert variant="danger" className="py-2">{errA}</Alert>}

              <div className="d-flex justify-content-between align-items-center mb-2">
                <div className="text-muted">
                  Agrega/edita acompañantes. (Mínimo: tipo doc + documento)
                </div>
                <Button size="sm" variant="outline-success" onClick={agregarFilaAcompanante}>
                  + Agregar
                </Button>
              </div>

              {formA.length === 0 ? (
                <div className="text-muted">No hay acompañantes. Puedes agregar uno.</div>
              ) : (
                formA.map((a, idx) => (
                  <Card key={idx} className="mb-2">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-center mb-2">
                        <div className="fw-semibold">Acompañante #{idx + 1}</div>
                        <Button size="sm" variant="outline-danger" onClick={() => quitarFilaAcompanante(idx)}>
                          Quitar
                        </Button>
                      </div>

                      <Row className="g-2">
                        <Col md={3}>
                          <Form.Label>Tipo doc.</Form.Label>
                          <Form.Select
                            value={a.tipo_documento}
                            onChange={(e) => updateFilaAcompanante(idx, "tipo_documento", e.target.value)}
                          >
                            {TIPOS_DOC.map((x) => (
                              <option key={x.value} value={x.value}>{x.label}</option>
                            ))}
                          </Form.Select>
                        </Col>

                        <Col md={3}>
                          <Form.Label>Documento</Form.Label>
                          <Form.Control
                            value={a.documento}
                            onChange={(e) => updateFilaAcompanante(idx, "documento", e.target.value)}
                          />
                        </Col>

                        <Col md={6}>
                          <Form.Label>Teléfono</Form.Label>
                          <Form.Control
                            value={a.telefono}
                            onChange={(e) => updateFilaAcompanante(idx, "telefono", e.target.value)}
                          />
                        </Col>

                        <Col md={4}>
                          <Form.Label>Nombres</Form.Label>
                          <Form.Control
                            value={a.nombres}
                            onChange={(e) => updateFilaAcompanante(idx, "nombres", e.target.value)}
                          />
                        </Col>

                        <Col md={4}>
                          <Form.Label>Primer apellido</Form.Label>
                          <Form.Control
                            value={a.primer_apellido}
                            onChange={(e) => updateFilaAcompanante(idx, "primer_apellido", e.target.value)}
                          />
                        </Col>

                        <Col md={4}>
                          <Form.Label>Segundo apellido</Form.Label>
                          <Form.Control
                            value={a.segundo_apellido}
                            onChange={(e) => updateFilaAcompanante(idx, "segundo_apellido", e.target.value)}
                          />
                        </Col>

                        <Col md={6}>
                          <Form.Label>Email</Form.Label>
                          <Form.Control
                            value={a.email}
                            onChange={(e) => updateFilaAcompanante(idx, "email", e.target.value)}
                          />
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))
              )}
            </Modal.Body>

            <Modal.Footer>
              <Button variant="outline-secondary" onClick={() => setShowEditA(false)} disabled={savingA}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={guardarAcompanantes} disabled={savingA}>
                {savingA ? "Guardando..." : "Guardar"}
              </Button>
            </Modal.Footer>
          </Modal>
        </>
      )}
    </div>
  );
}
