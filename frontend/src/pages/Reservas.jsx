// src/pages/Reservas.jsx

import { useEffect, useState, useCallback, useRef } from "react";
import dayjs from "dayjs";
import reservasService  from "../services/reservasService";
import huespedesService from "../services/huespedesService";
import {
  Table, Button, Badge, Form,
  Row, Col, Spinner, Modal, Card, Nav, Alert,
} from "react-bootstrap";


// Lee el rol del payload JWT sin librerías externas
const getRolActual = () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) return "";
    const payload = JSON.parse(atob(token.split(".")[1]));
    return String(payload?.rol || "").toLowerCase();
  } catch {
    return "";
  }
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const estadoColor = (e) =>
  ({ reservada:"primary", ocupada:"success", cancelada:"secondary", finalizada:"dark" }[e] || "light");
const estadoLabel = (e) =>
  ({ reservada:"Reservada", ocupada:"Ocupada", cancelada:"Cancelada", finalizada:"Finalizada" }[e] || e);

const FUENTES = ["recepcion","telefono","walkin","booking","airbnb","web","otro"];
const fuenteLabel = (f) =>
  ({ recepcion:"Recepción", telefono:"Teléfono", walkin:"Walk-in",
     booking:"Booking.com", airbnb:"Airbnb", web:"Web propia", otro:"Otro" }[f] || f || "—");

const TIPOS_DOC = ["CC","CE","PA","TI","NIT"];

const semaforoColor = (s) =>
  ({ checked_in:"success", pendiente:"warning", no_show:"danger" }[s] || "secondary");
const semaforoLabel = (s) =>
  ({ checked_in:"✅ Check-in hecho", pendiente:"⏳ Pendiente", no_show:"❌ No-show" }[s] || s);

const accionHistLabel = (a) =>
  ({ created:"✨ Creada", updated:"✏️ Modificada", checkin:"🏨 Check-in",
     checkout:"🚪 Check-out", cancelada:"❌ Cancelada", no_show:"🚫 No-show",
     extendida:"📅 Extendida" }[a] || a);

// ── Componente ────────────────────────────────────────────────────────────────
export default function Reservas() {
  // Vista activa
  const [vista, setVista] = useState("lista");
  const esAdmin = getRolActual() === "admin";

  // ── Lista de reservas ─────────────────────────────────────────────────────
  const [reservas,   setReservas]   = useState([]);
  const [cargando,   setCargando]   = useState(true);
  const [error,      setError]      = useState("");
  const [filtroTexto,  setFiltroTexto]  = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");
  const [filtroDesde,  setFiltroDesde]  = useState("");
  const [filtroHasta,  setFiltroHasta]  = useState("");

  // ── Llegadas del día ──────────────────────────────────────────────────────
  const [llegadas,         setLlegadas]         = useState([]);
  const [cargandoLlegadas, setCargandoLlegadas] = useState(false);
  const [errorLlegadas,    setErrorLlegadas]    = useState("");
  const [fechaLlegadas,    setFechaLlegadas]    = useState(dayjs().format("YYYY-MM-DD"));

  // ── Modal editar ──────────────────────────────────────────────────────────
  const [showModal,     setShowModal]     = useState(false);
  const [cargandoModal, setCargandoModal] = useState(false);
  const [guardando,     setGuardando]     = useState(false);
  const [errorModal,    setErrorModal]    = useState("");
  const [tabActiva,     setTabActiva]     = useState("reserva");
  const [reservaSel,    setReservaSel]    = useState(null);
  const [titular,       setTitular]       = useState(null);
  const [habitaciones,  setHabitaciones]  = useState([]);
  const lastKeyRef = useRef("");

  // ── Modal extender ────────────────────────────────────────────────────────
  const [showExtender,    setShowExtender]    = useState(false);
  const [reservaExtender, setReservaExtender] = useState(null);
  const [nuevaFechaFin,   setNuevaFechaFin]   = useState("");
  const [extendiendo,     setExtendiendo]     = useState(false);
  const [errorExtender,   setErrorExtender]   = useState("");

  // ── Modal historial ───────────────────────────────────────────────────────
  const [showHistorial, setShowHistorial] = useState(false);
  const [historial,     setHistorial]     = useState([]);
  const [cargandoHist,  setCargandoHist]  = useState(false);
  const [reservaHistId, setReservaHistId] = useState(null);

  // ── Modal no-show ─────────────────────────────────────────────────────────
  const [showNoShow,     setShowNoShow]     = useState(false);
  const [reservaNoShow,  setReservaNoShow]  = useState(null);
  const [marcandoNoShow, setMarcandoNoShow] = useState(false);
  const [errorNoShow,    setErrorNoShow]    = useState("");

  // ─────────────────────────────────────────────────────────────────────────
  // HU-R7: Cargar reservas con filtros
  // ─────────────────────────────────────────────────────────────────────────
  const cargarReservas = useCallback(async (opts = {}) => {
    try {
      setCargando(true); setError("");
      const params = {};
      const texto = opts.q      !== undefined ? opts.q      : filtroTexto;
      const est   = opts.estado !== undefined ? opts.estado : filtroEstado;
      const desde = opts.desde  !== undefined ? opts.desde  : filtroDesde;
      const hasta = opts.hasta  !== undefined ? opts.hasta  : filtroHasta;
      if (texto.trim())    params.q      = texto.trim();
      if (est !== "todas") params.estado = est;
      if (desde.trim())    params.desde  = desde.trim();
      if (hasta.trim())    params.hasta  = hasta.trim();
      const r = await reservasService.listar(params);
      setReservas(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      setError(e?.response?.data?.message || "Error al cargar reservas.");
    } finally {
      setCargando(false);
    }
  }, [filtroTexto, filtroEstado, filtroDesde, filtroHasta]);

  useEffect(() => { cargarReservas(); }, []); // eslint-disable-line

  const aplicarFiltros = () => cargarReservas();
  const limpiarFiltros = () => {
    setFiltroTexto(""); setFiltroEstado("todas");
    setFiltroDesde(""); setFiltroHasta("");
    cargarReservas({ q:"", estado:"todas", desde:"", hasta:"" });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HU-R13: Llegadas del día
  // ─────────────────────────────────────────────────────────────────────────
  const cargarLlegadas = useCallback(async (fecha) => {
    try {
      setCargandoLlegadas(true); setErrorLlegadas("");
      const r = await reservasService.llegadas({ fecha: fecha || fechaLlegadas });
      setLlegadas(r.data.items || []);
    } catch (e) {
      setErrorLlegadas(e?.response?.data?.message || "Error al cargar llegadas.");
    } finally {
      setCargandoLlegadas(false);
    }
  }, [fechaLlegadas]);

  useEffect(() => {
    if (vista === "llegadas") cargarLlegadas(fechaLlegadas);
  }, [vista, fechaLlegadas]); // eslint-disable-line

  // ─────────────────────────────────────────────────────────────────────────
  // HU-R4: Modal editar
  // ─────────────────────────────────────────────────────────────────────────
  const abrirModal = async (reserva) => {
    setErrorModal(""); setTabActiva("reserva"); setHabitaciones([]);
    setCargandoModal(true); setShowModal(true);
    setReservaSel({
      id:                reserva.id,
      fecha_inicio:      dayjs(reserva.fecha_inicio).format("YYYY-MM-DD"),
      fecha_fin:         dayjs(reserva.fecha_fin).format("YYYY-MM-DD"),
      notas:             reserva.notas || "",
      estado:            reserva.estado,
      habitacion_numero: String(reserva.habitacion_numero),
      habitacion_tipo:   reserva.habitacion_tipo,
      fuente:            reserva.fuente || "recepcion",
    });
    setTitular(null);
    try {
      const { data } = await reservasService.datosCheckin(reserva.id);
      setTitular({
        huesped_id:       data.huesped_id       || null,
        tipo_documento:   data.tipo_documento   || "",
        documento:        data.documento        || "",
        nombres:          data.nombres          || "",
        primer_apellido:  data.primer_apellido  || "",
        segundo_apellido: data.segundo_apellido || "",
        telefono:         data.telefono         || "",
        email:            data.email            || "",
      });
      if (reserva.estado === "reservada") {
        try {
          const dispR = await reservasService.habitacionesDisp({
            desde: dayjs(reserva.fecha_inicio).format("YYYY-MM-DD"),
            hasta: dayjs(reserva.fecha_fin).format("YYYY-MM-DD"),
          });
          const lista = dispR.data || [];
          if (!lista.some(h => String(h.numero) === String(reserva.habitacion_numero)))
            lista.unshift({ numero: reserva.habitacion_numero, tipo: reserva.habitacion_tipo });
          setHabitaciones(lista);
        } catch {
          setHabitaciones([{ numero: reserva.habitacion_numero, tipo: reserva.habitacion_tipo }]);
        }
      }
    } catch {
      setErrorModal("No se pudieron cargar los datos del titular.");
    } finally {
      setCargandoModal(false);
    }
  };

  const cerrarModal = () => {
    setShowModal(false); setReservaSel(null); setTitular(null); setErrorModal("");
  };
  const handleReserva = (campo, valor) => setReservaSel(p => ({ ...p, [campo]: valor }));
  const handleTitular = (campo, valor) => setTitular(p => ({ ...p, [campo]: valor }));

  // Autocompletar huésped por documento
  useEffect(() => {
    if (!titular) return;
    const td  = (titular.tipo_documento || "").trim().toUpperCase();
    const doc = (titular.documento || "").trim();
    if (!td || doc.length < 5) {
      lastKeyRef.current = "";
      setTitular(p => ({ ...p, huesped_id: null })); return;
    }
    const key = `${td}|${doc}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    const timer = setTimeout(async () => {
      try {
        const r = await huespedesService.buscar({ tipo_documento: td, documento: doc });
        if (lastKeyRef.current !== key) return;
        setTitular(p => ({
          ...p, huesped_id: r.data.id,
          nombres: r.data.nombres || "", primer_apellido: r.data.primer_apellido || "",
          segundo_apellido: r.data.segundo_apellido || "",
          telefono: r.data.telefono || "", email: r.data.email || "",
        }));
      } catch {
        if (lastKeyRef.current === key)
          setTitular(p => ({
            ...p, huesped_id: null, nombres: "", primer_apellido: "",
            segundo_apellido: "", telefono: "", email: "",
          }));
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [titular?.tipo_documento, titular?.documento]); // eslint-disable-line

  const guardarCambios = async () => {
    if (!reservaSel) return;
    setErrorModal("");
    if (titular?.huesped_id && reservaSel.estado !== "finalizada") {
      if (!titular.nombres?.trim()) {
        setErrorModal("El campo 'Nombres' es obligatorio."); setTabActiva("huesped"); return;
      }
      if (!titular.primer_apellido?.trim()) {
        setErrorModal("El campo 'Primer apellido' es obligatorio."); setTabActiva("huesped"); return;
      }
    }
    setGuardando(true);
    try {
      const body = {
        fecha_inicio:      reservaSel.fecha_inicio,
        fecha_fin:         reservaSel.fecha_fin,
        notas:             reservaSel.notas || null,
        habitacion_numero: reservaSel.habitacion_numero || undefined,
        fuente:            reservaSel.fuente,
      };
      await reservasService.actualizar(reservaSel.id, body);

      if (titular?.huesped_id && reservaSel.estado !== "finalizada") {
        await huespedesService.actualizar(titular.huesped_id, {
          nombres:          titular.nombres.trim(),
          primer_apellido:  titular.primer_apellido.trim(),
          segundo_apellido: titular.segundo_apellido?.trim() || null,
          tipo_documento:   titular.tipo_documento  || null,
          documento:        titular.documento?.trim() || null,
          telefono:         titular.telefono?.trim() || null,
          email:            titular.email?.trim()    || null,
        });
      }
      await cargarReservas(); cerrarModal();
    } catch (e) {
      const st  = e?.response?.status;
      const msg = e?.response?.data?.message;
      if (st === 409) { setTabActiva("reserva"); setErrorModal(msg || "Choque de fechas."); }
      else if (st === 400) { setTabActiva("huesped"); setErrorModal(msg || "Verifica los datos."); }
      else setErrorModal(msg || "No se pudo actualizar la reserva.");
    } finally {
      setGuardando(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HU-R5: Cancelar
  // ─────────────────────────────────────────────────────────────────────────
  const cancelarReserva = async (r) => {
    if (!window.confirm(`¿Cancelar reserva #${r.id} de ${r.huesped_nombre || "este huésped"}?`)) return;
    try {
      await reservasService.cancelar(r.id, {});
      await cargarReservas();
    } catch (e) {
      alert(e?.response?.data?.message || "No se pudo cancelar.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HU-R14: No-show
  // ─────────────────────────────────────────────────────────────────────────
  const abrirNoShow = (r) => { setReservaNoShow(r); setErrorNoShow(""); setShowNoShow(true); };
  const confirmarNoShow = async () => {
    if (!reservaNoShow) return;
    setMarcandoNoShow(true); setErrorNoShow("");
    try {
      await reservasService.noShow(reservaNoShow.id, {});
      setShowNoShow(false);
      await cargarReservas();
      if (vista === "llegadas") await cargarLlegadas(fechaLlegadas);
    } catch (e) {
      setErrorNoShow(e?.response?.data?.message || "Error al marcar no-show.");
    } finally {
      setMarcandoNoShow(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HU-R8: Extender estadía
  // ─────────────────────────────────────────────────────────────────────────
  const abrirExtender = (r) => {
    setReservaExtender(r);
    setNuevaFechaFin(dayjs(r.fecha_fin).add(1,"day").format("YYYY-MM-DD"));
    setErrorExtender(""); setShowExtender(true);
  };
  const confirmarExtender = async () => {
    if (!reservaExtender || !nuevaFechaFin) return;
    setExtendiendo(true); setErrorExtender("");
    try {
      await reservasService.extender(reservaExtender.id, { nueva_fecha_fin: nuevaFechaFin, usuario: "recepcion" });
      setShowExtender(false);
      await cargarReservas();
    } catch (e) {
      setErrorExtender(e?.response?.data?.message || "No se pudo extender la estadía.");
    } finally {
      setExtendiendo(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // HU-R11: Historial
  // ─────────────────────────────────────────────────────────────────────────
  const abrirHistorial = async (r) => {
    setReservaHistId(r.id); setHistorial([]); setCargandoHist(true); setShowHistorial(true);
    try {
      const { data } = await reservasService.historial(r.id);
      setHistorial(data);
    } catch { setHistorial([]); }
    finally { setCargandoHist(false); }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Botones de acción por fila
  // ─────────────────────────────────────────────────────────────────────────
  const accionesFila = (r) => (
    <div className="d-flex gap-1 flex-wrap">
      {["reservada","ocupada"].includes(r.estado) && (
        <Button variant="outline-primary" size="sm" onClick={() => abrirModal(r)} title="Editar reserva">✏️</Button>
      )}
      {r.estado === "ocupada" && (
        <Button variant="outline-success" size="sm" onClick={() => abrirExtender(r)} title="Extender estadía">📅+</Button>
      )}
      {r.estado === "reservada" && (
        <Button variant="outline-warning" size="sm" onClick={() => abrirNoShow(r)} title="Marcar no-show">🚫</Button>
      )}
      {esAdmin && (
        <Button variant="outline-secondary" size="sm" onClick={() => abrirHistorial(r)} title="Ver historial">📋</Button>
      )}
      <Button
        variant="outline-danger" size="sm"
        disabled={r.estado !== "reservada"}
        title={r.estado !== "reservada" ? "Solo cancelables en estado reservada" : "Cancelar"}
        onClick={() => cancelarReserva(r)}
      >✕</Button>
    </div>
  );

  const esSoloLectura = reservaSel?.estado === "ocupada" || reservaSel?.estado === "finalizada";

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Cabecera ───────────────────────────────────────── */}
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h3 className="mb-0">Gestión de reservas</h3>
          {vista === "lista" && (
            <div className="text-muted" style={{ fontSize: 13 }}>{reservas.length} reservas encontradas</div>
          )}
        </div>
        <div className="d-flex gap-2">
          <Button size="sm"
            variant={vista === "lista" ? "primary" : "outline-primary"}
            onClick={() => { setVista("lista"); cargarReservas(); }}>
            📋 Lista
          </Button>
          <Button size="sm"
            variant={vista === "llegadas" ? "primary" : "outline-primary"}
            onClick={() => setVista("llegadas")}>
            🏨 Llegadas del día
          </Button>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════ */}
      {/* VISTA LISTA                                          */}
      {/* ══════════════════════════════════════════════════════ */}
      {vista === "lista" && (<>
        <Card className="mb-3 shadow-sm">
          <Card.Body className="py-2">
            <Row className="g-2 align-items-end">
              <Col md={4}>
                <Form.Label className="mb-1" style={{ fontSize: 13 }}>Huésped / Doc / Hab / ID</Form.Label>
                <Form.Control size="sm" placeholder="Ej: García / 1006 / 101"
                  value={filtroTexto} onChange={e => setFiltroTexto(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && aplicarFiltros()} />
              </Col>
              <Col md={2}>
                <Form.Label className="mb-1" style={{ fontSize: 13 }}>Estado</Form.Label>
                <Form.Select size="sm" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
                  <option value="todas">Todos</option>
                  <option value="reservada">Reservada</option>
                  <option value="ocupada">Ocupada</option>
                  <option value="finalizada">Finalizada</option>
                  <option value="cancelada">Cancelada</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Label className="mb-1" style={{ fontSize: 13 }}>Ingreso desde</Form.Label>
                <Form.Control size="sm" type="date" value={filtroDesde} onChange={e => setFiltroDesde(e.target.value)} />
              </Col>
              <Col md={2}>
                <Form.Label className="mb-1" style={{ fontSize: 13 }}>Ingreso hasta</Form.Label>
                <Form.Control size="sm" type="date" value={filtroHasta} onChange={e => setFiltroHasta(e.target.value)} />
              </Col>
              <Col md={2} className="d-flex gap-2">
                <Button variant="primary" size="sm" className="w-100" onClick={aplicarFiltros} disabled={cargando}>Buscar</Button>
                <Button variant="outline-secondary" size="sm" className="w-100" onClick={limpiarFiltros} disabled={cargando}>Limpiar</Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {error && <Alert variant="danger" className="py-2">{error}</Alert>}

        {cargando ? (
          <div className="d-flex justify-content-center py-5"><Spinner animation="border" /></div>
        ) : reservas.length === 0 ? (
          <Alert variant="warning">No hay reservas que coincidan con los filtros.</Alert>
        ) : (
          <div className="table-responsive">
            <Table striped hover size="sm" className="align-middle">
              <thead className="table-light">
                <tr>
                  <th>#</th><th>Huésped</th><th>Habitación</th>
                  <th>Ingreso</th><th>Salida</th><th>Estado</th>
                  <th>Fuente</th><th>Notas</th><th style={{ width: 155 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {reservas.map(r => (
                  <tr key={r.id} className={r.no_show ? "table-danger" : ""}>
                    <td className="text-muted" style={{ fontSize: 12 }}>#{r.id}</td>
                    <td>{r.huesped_nombre || <span className="text-muted">—</span>}</td>
                    <td>
                      <span className="fw-semibold">Hab. {r.habitacion_numero}</span>{" "}
                      <small className="text-muted">— {r.habitacion_tipo}</small>
                    </td>
                    <td>{dayjs(r.fecha_inicio).format("DD/MM/YY")}</td>
                    <td>{dayjs(r.fecha_fin).format("DD/MM/YY")}</td>
                    <td>
                      <Badge bg={estadoColor(r.estado)}>{estadoLabel(r.estado)}</Badge>
                      {r.no_show && <Badge bg="danger" className="ms-1" style={{ fontSize: 10 }}>No-show</Badge>}
                    </td>
                    <td><small className="text-muted">{fuenteLabel(r.fuente)}</small></td>
                    <td style={{ maxWidth: 150 }}>
                      <small className="text-muted">
                        {r.notas ? (r.notas.length > 40 ? r.notas.slice(0,40)+"..." : r.notas) : "—"}
                      </small>
                    </td>
                    <td>{accionesFila(r)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </>)}

      {/* ══════════════════════════════════════════════════════ */}
      {/* VISTA LLEGADAS DEL DÍA — HU-R13                     */}
      {/* ══════════════════════════════════════════════════════ */}
      {vista === "llegadas" && (<>
        <Card className="mb-3 shadow-sm">
          <Card.Body className="py-2">
            <Row className="g-2 align-items-end">
              <Col md={3}>
                <Form.Label className="mb-1" style={{ fontSize: 13 }}>Fecha</Form.Label>
                <Form.Control size="sm" type="date" value={fechaLlegadas}
                  onChange={e => setFechaLlegadas(e.target.value)} />
              </Col>
              <Col md={2}>
                <Button variant="primary" size="sm" disabled={cargandoLlegadas}
                  onClick={() => cargarLlegadas(fechaLlegadas)}>
                  {cargandoLlegadas ? <Spinner animation="border" size="sm" /> : "Buscar"}
                </Button>
              </Col>
              <Col className="d-flex align-items-end gap-3" style={{ fontSize: 13 }}>
                <span><Badge bg="warning" text="dark">⏳</Badge> Pendiente</span>
                <span><Badge bg="success">✅</Badge> Check-in hecho</span>
                <span><Badge bg="danger">❌</Badge> No-show</span>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {errorLlegadas && <Alert variant="danger">{errorLlegadas}</Alert>}

        {cargandoLlegadas ? (
          <div className="d-flex justify-content-center py-5"><Spinner animation="border" /></div>
        ) : llegadas.length === 0 ? (
          <Alert variant="info">
            No hay llegadas registradas para el {dayjs(fechaLlegadas).format("DD/MM/YYYY")}.
          </Alert>
        ) : (
          <>
            <div className="mb-2 text-muted" style={{ fontSize: 13 }}>
              {llegadas.length} llegada(s) — {dayjs(fechaLlegadas).format("DD/MM/YYYY")}
            </div>
            <div className="table-responsive">
              <Table hover size="sm" className="align-middle">
                <thead className="table-light">
                  <tr>
                    <th>#</th><th>Estado</th><th>Huésped</th>
                    <th>Habitación</th><th>Salida</th><th>Teléfono</th>
                    <th>Fuente</th><th>Notas</th><th style={{ width: 90 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {llegadas.map(r => (
                    <tr key={r.id}
                      className={
                        r.semaforo === "no_show"    ? "table-danger"
                        : r.semaforo === "checked_in" ? "table-success"
                        : "table-warning"
                      }
                    >
                      <td className="text-muted" style={{ fontSize: 12 }}>#{r.id}</td>
                      <td><Badge bg={semaforoColor(r.semaforo)}>{semaforoLabel(r.semaforo)}</Badge></td>
                      <td>
                        <div>{r.huesped_nombre || <span className="text-muted">Sin nombre</span>}</div>
                        {r.documento && <small className="text-muted">{r.documento}</small>}
                      </td>
                      <td>
                        <span className="fw-semibold">Hab. {r.habitacion_numero}</span>{" "}
                        <small className="text-muted">— {r.habitacion_tipo}</small>
                      </td>
                      <td>{dayjs(r.fecha_fin).format("DD/MM/YY")}</td>
                      <td><small>{r.telefono || "—"}</small></td>
                      <td><small className="text-muted">{fuenteLabel(r.fuente)}</small></td>
                      <td style={{ maxWidth: 130 }}>
                        <small className="text-muted">
                          {r.notas ? (r.notas.length > 30 ? r.notas.slice(0,30)+"..." : r.notas) : "—"}
                        </small>
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          {r.semaforo === "pendiente" && (
                            <Button variant="outline-warning" size="sm"
                              onClick={() => abrirNoShow(r)} title="Marcar no-show">🚫</Button>
                          )}
                          {esAdmin && (
                            <Button variant="outline-secondary" size="sm"
                              onClick={() => abrirHistorial(r)} title="Historial">📋</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </>
        )}
      </>)}

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL EDITAR RESERVA                                 */}
      {/* ══════════════════════════════════════════════════════ */}
      <Modal show={showModal} onHide={cerrarModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Editar reserva #{reservaSel?.id}{" "}
            {reservaSel && (
              <Badge bg={estadoColor(reservaSel.estado)} className="ms-2" style={{ fontSize: 13 }}>
                {estadoLabel(reservaSel.estado)}
              </Badge>
            )}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cargandoModal ? (
            <div className="d-flex justify-content-center py-4"><Spinner animation="border" /></div>
          ) : (<>
            <Nav variant="tabs" className="mb-3" activeKey={tabActiva} onSelect={k => setTabActiva(k)}>
              <Nav.Item><Nav.Link eventKey="reserva">📅 Reserva</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="huesped">👤 Titular</Nav.Link></Nav.Item>
            </Nav>

            {/* ── Tab Reserva ── */}
            {tabActiva === "reserva" && reservaSel && (
              <div>
                {esSoloLectura && (
                  <Alert variant="info" className="py-2 mb-3" style={{ fontSize: 13 }}>
                    La reserva está <b>{estadoLabel(reservaSel.estado)}</b>. Solo se pueden editar notas y fuente.
                  </Alert>
                )}
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Label>Fecha de ingreso</Form.Label>
                    <Form.Control type="date" value={reservaSel.fecha_inicio} disabled={esSoloLectura}
                      onChange={e => handleReserva("fecha_inicio", e.target.value)} />
                  </Col>
                  <Col md={6}>
                    <Form.Label>Fecha de salida</Form.Label>
                    <Form.Control type="date" value={reservaSel.fecha_fin} disabled={esSoloLectura}
                      onChange={e => handleReserva("fecha_fin", e.target.value)} />
                  </Col>
                </Row>

                {reservaSel.estado === "reservada" && habitaciones.length > 1 && (
                  <Form.Group className="mb-3">
                    <Form.Label>Habitación</Form.Label>
                    <Form.Select value={reservaSel.habitacion_numero}
                      onChange={e => handleReserva("habitacion_numero", e.target.value)}>
                      {habitaciones.map(h => (
                        <option key={h.numero} value={String(h.numero)}>
                          Hab. {h.numero} — {h.tipo}
                          {String(h.numero) === String(reservaSel.habitacion_numero) ? " (actual)" : ""}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                )}

                {/* HU-R15: Fuente */}
                <Form.Group className="mb-3">
                  <Form.Label>Canal / Fuente de reserva</Form.Label>
                  <Form.Select value={reservaSel.fuente}
                    onChange={e => handleReserva("fuente", e.target.value)}>
                    {FUENTES.map(f => <option key={f} value={f}>{fuenteLabel(f)}</option>)}
                  </Form.Select>
                </Form.Group>

                {/* HU-R6: Notas */}
                <Form.Group>
                  <Form.Label>
                    Notas internas{" "}
                    <small className="text-muted">(solo visibles para el personal)</small>
                  </Form.Label>
                  <Form.Control as="textarea" rows={3} value={reservaSel.notas}
                    onChange={e => handleReserva("notas", e.target.value)}
                    placeholder="Instrucciones especiales, alergias, preferencias..." />
                </Form.Group>
              </div>
            )}

            {/* ── Tab Titular ── */}
            {tabActiva === "huesped" && (
              <div>
                {!titular ? (
                  <div className="text-muted py-2">No se encontraron datos del titular.</div>
                ) : (<>
                  {reservaSel?.estado === "finalizada" && (
                    <Alert variant="warning" className="py-2 mb-3" style={{ fontSize: 13 }}>
                      Reserva <b>finalizada</b>. Datos de solo lectura.
                    </Alert>
                  )}
                  {!titular.huesped_id && (
                    <Alert variant="info" className="py-2 mb-3" style={{ fontSize: 13 }}>
                      El titular aún no tiene documento registrado. Se confirma en Check-In.
                    </Alert>
                  )}
                  <Row className="g-2">
                    <Col md={4}>
                      <Form.Label>Tipo documento</Form.Label>
                      <Form.Select value={titular.tipo_documento}
                        disabled={reservaSel?.estado === "finalizada"}
                        onChange={e => handleTitular("tipo_documento", e.target.value)}>
                        <option value="">Seleccione...</option>
                        {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                      </Form.Select>
                    </Col>
                    <Col md={8}>
                      <Form.Label>Documento</Form.Label>
                      <Form.Control value={titular.documento}
                        disabled={reservaSel?.estado === "finalizada"}
                        onChange={e => handleTitular("documento", e.target.value)}
                        placeholder="Número de documento" />
                    </Col>
                    <Col md={4}>
                      <Form.Label>Nombres *</Form.Label>
                      <Form.Control value={titular.nombres}
                        disabled={reservaSel?.estado === "finalizada"}
                        onChange={e => handleTitular("nombres", e.target.value)} />
                    </Col>
                    <Col md={4}>
                      <Form.Label>Primer apellido *</Form.Label>
                      <Form.Control value={titular.primer_apellido}
                        disabled={reservaSel?.estado === "finalizada"}
                        onChange={e => handleTitular("primer_apellido", e.target.value)} />
                    </Col>
                    <Col md={4}>
                      <Form.Label>Segundo apellido</Form.Label>
                      <Form.Control value={titular.segundo_apellido}
                        disabled={reservaSel?.estado === "finalizada"}
                        onChange={e => handleTitular("segundo_apellido", e.target.value)} />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Teléfono</Form.Label>
                      <Form.Control value={titular.telefono}
                        disabled={reservaSel?.estado === "finalizada"}
                        onChange={e => handleTitular("telefono", e.target.value)} />
                    </Col>
                    <Col md={6}>
                      <Form.Label>Email</Form.Label>
                      <Form.Control value={titular.email}
                        disabled={reservaSel?.estado === "finalizada"}
                        onChange={e => handleTitular("email", e.target.value)} />
                    </Col>
                  </Row>
                  <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                    Nombre completo:{" "}
                    <b>{[titular.nombres, titular.primer_apellido, titular.segundo_apellido]
                      .map(x => (x||"").trim()).filter(Boolean).join(" ") || "—"}</b>
                  </div>
                </>)}
              </div>
            )}

            {errorModal && (
              <Alert variant="danger" className="mt-3 py-2 mb-0" style={{ fontSize: 13 }}>{errorModal}</Alert>
            )}
          </>)}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarModal} disabled={guardando}>Cerrar</Button>
          <Button variant="primary" onClick={guardarCambios} disabled={guardando || cargandoModal}>
            {guardando
              ? <><Spinner animation="border" size="sm" className="me-2" />Guardando...</>
              : "Guardar cambios"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL EXTENDER ESTADÍA — HU-R8                       */}
      {/* ══════════════════════════════════════════════════════ */}
      <Modal show={showExtender} onHide={() => setShowExtender(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>📅 Extender estadía — Reserva #{reservaExtender?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {reservaExtender && (<>
            <div className="mb-3" style={{ fontSize: 14 }}>
              <div><b>Huésped:</b> {reservaExtender.huesped_nombre || "—"}</div>
              <div><b>Habitación:</b> Hab. {reservaExtender.habitacion_numero}</div>
              <div><b>Salida actual:</b> {dayjs(reservaExtender.fecha_fin).format("DD/MM/YYYY")}</div>
            </div>
            <Form.Group>
              <Form.Label>Nueva fecha de salida</Form.Label>
              <Form.Control type="date" value={nuevaFechaFin}
                min={dayjs(reservaExtender.fecha_fin).add(1,"day").format("YYYY-MM-DD")}
                onChange={e => setNuevaFechaFin(e.target.value)} />
              <Form.Text className="text-muted">
                El cargo adicional de alojamiento se generará automáticamente.
              </Form.Text>
            </Form.Group>
            {errorExtender && (
              <Alert variant="danger" className="mt-2 py-2" style={{ fontSize: 13 }}>{errorExtender}</Alert>
            )}
          </>)}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExtender(false)} disabled={extendiendo}>Cancelar</Button>
          <Button variant="success" onClick={confirmarExtender} disabled={extendiendo || !nuevaFechaFin}>
            {extendiendo
              ? <><Spinner animation="border" size="sm" className="me-2" />Extendiendo...</>
              : "Confirmar extensión"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL HISTORIAL — HU-R11                             */}
      {/* ══════════════════════════════════════════════════════ */}
      <Modal show={showHistorial} onHide={() => setShowHistorial(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>📋 Historial — Reserva #{reservaHistId}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {cargandoHist ? (
            <div className="d-flex justify-content-center py-3"><Spinner animation="border" /></div>
          ) : historial.length === 0 ? (
            <div className="text-muted text-center py-3">Sin registros de historial aún.</div>
          ) : (
            <div className="table-responsive">
              <Table size="sm" className="align-middle">
                <thead className="table-light">
                  <tr>
                    <th>Fecha / Hora</th><th>Acción</th><th>Usuario</th><th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.map(h => (
                    <tr key={h.id}>
                      <td style={{ fontSize: 12, whiteSpace:"nowrap" }}>
                        {dayjs(h.created_at).format("DD/MM/YY HH:mm")}
                      </td>
                      <td><Badge bg="secondary">{accionHistLabel(h.accion)}</Badge></td>
                      <td style={{ fontSize: 12 }}>{h.usuario || "—"}</td>
                      <td style={{ fontSize: 12 }}>
                        {h.notas || ""}
                        {h.campo && (
                          <span className="text-muted ms-1">
                            [{h.campo}: {h.valor_anterior} → {h.valor_nuevo}]
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHistorial(false)}>Cerrar</Button>
        </Modal.Footer>
      </Modal>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL NO-SHOW — HU-R14                               */}
      {/* ══════════════════════════════════════════════════════ */}
      <Modal show={showNoShow} onHide={() => setShowNoShow(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>🚫 Marcar como No-Show</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {reservaNoShow && (<>
            <Alert variant="warning" className="py-2">
              Esta acción <b>cancelará</b> la reserva y la marcará como no-show. No se puede deshacer.
            </Alert>
            <div style={{ fontSize: 14 }}>
              <div><b>Reserva #:</b> {reservaNoShow.id}</div>
              <div><b>Huésped:</b> {reservaNoShow.huesped_nombre || "—"}</div>
              <div><b>Habitación:</b> Hab. {reservaNoShow.habitacion_numero}</div>
              <div><b>Fecha de llegada:</b> {dayjs(reservaNoShow.fecha_inicio).format("DD/MM/YYYY")}</div>
            </div>
            {errorNoShow && (
              <Alert variant="danger" className="mt-2 py-2" style={{ fontSize: 13 }}>{errorNoShow}</Alert>
            )}
          </>)}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNoShow(false)} disabled={marcandoNoShow}>Cancelar</Button>
          <Button variant="danger" onClick={confirmarNoShow} disabled={marcandoNoShow}>
            {marcandoNoShow
              ? <><Spinner animation="border" size="sm" className="me-2" />Procesando...</>
              : "Confirmar no-show"}
          </Button>
        </Modal.Footer>
      </Modal>

    </div>
  );
}