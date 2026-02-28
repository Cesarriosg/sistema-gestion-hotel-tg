
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";
import {
  Card, Table, Row, Col, Form, Button, Spinner,
  Alert, Badge, Modal, Nav,
} from "react-bootstrap";

const API = "http://localhost:4000";
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const TIPOS_DOC = ["CC","CE","PA","TI","NIT"];

const NACIONALIDADES = [
  "Colombiana","Venezolana","Ecuatoriana","Peruana","Boliviana",
  "Brasileña","Chilena","Argentina","Mexicana","Estadounidense",
  "Española","Italiana","Francesa","Alemana","Portuguesa",
  "Panameña","Costarricense","Hondureña","Salvadoreña","Guatemalteca",
  "Dominicana","Cubana","Haitiana","Jamaicana","Canadiense",
  "Inglesa","China","Japonesa","Coreana","Otra",
];

const nombreMostrar = (h) =>
  [h.nombres, h.primer_apellido, h.segundo_apellido]
    .map(x => (x||"").trim()).filter(Boolean).join(" ") || h.nombre || "—";

const estadoColor = (e) =>
  ({ reservada:"primary", ocupada:"success", cancelada:"secondary", finalizada:"dark" }[e] || "light");
const estadoLabel = (e) =>
  ({ reservada:"Reservada", ocupada:"Ocupada", cancelada:"Cancelada", finalizada:"Finalizada" }[e] || e);

const FORM_VACIO = {
  nombres:"", primer_apellido:"", segundo_apellido:"",
  tipo_documento:"", documento:"",
  fecha_nacimiento:"", fecha_expedicion:"",
  telefono:"", email:"",
  nacionalidad:"", ciudad:"", direccion:"",
};

export default function Huespedes() {
  // Lista  
  const [q,         setQ]         = useState("");
  const [page,      setPage]      = useState(1);
  const limit = 20;
  const [items,     setItems]     = useState([]);
  const [total,     setTotal]     = useState(0);
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState("");

  // Modal  
  const [showModal,   setShowModal]   = useState(false);
  const [modo,        setModo]        = useState("ver");   // "ver" | "editar" | "nuevo"
  const [tabActiva,   setTabActiva]   = useState("datos");
  const [huespedSel,  setHuespedSel]  = useState(null);
  const [form,        setForm]        = useState(FORM_VACIO);
  const [estadias,    setEstadias]    = useState([]);
  const [cargandoEst, setCargandoEst] = useState(false);
  const [guardando,   setGuardando]   = useState(false);
  const [errorModal,  setErrorModal]  = useState("");
  const [okModal,     setOkModal]     = useState("");

    
  // Cargar lista
    
  const cargar = useCallback(async (opts = {}) => {
    try {
      setCargando(true); setError("");
      const p  = opts.page !== undefined ? opts.page : page;
      const qq = opts.q    !== undefined ? opts.q    : q;
      const r  = await axios.get(`${API}/api/huespedes`, {
        params: { q: qq, page: p, limit },
        headers: getAuthHeaders(),
      });
      setItems(r.data.items || []);
      setTotal(Number(r.data.total || 0));
      setPage(Number(r.data.page || p));
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudieron cargar los huéspedes.");
    } finally {
      setCargando(false);
    }
  }, [page, q]);

  useEffect(() => { cargar({ page:1 }); }, []); // eslint-disable-line

  const buscar  = () => cargar({ page:1 });
  const limpiar = () => { setQ(""); cargar({ q:"", page:1 }); };
  const totalPages = Math.max(1, Math.ceil(total / limit));

    
  // Cargar estadías de un huésped
    
  const cargarEstadias = async (id) => {
    setCargandoEst(true);
    try {
      const { data } = await axios.get(
        `${API}/api/huespedes/${id}/estadias`, { headers: getAuthHeaders() });
      setEstadias(data || []);
    } catch { setEstadias([]); }
    finally { setCargandoEst(false); }
  };

    
  // Abrir modal VER
    
  const abrirVer = (h) => {
    setHuespedSel(h);
    setForm({
      nombres:          h.nombres          || "",
      primer_apellido:  h.primer_apellido  || "",
      segundo_apellido: h.segundo_apellido || "",
      tipo_documento:   h.tipo_documento   || "",
      documento:        h.documento        || "",
      fecha_nacimiento: h.fecha_nacimiento ? dayjs(h.fecha_nacimiento).format("YYYY-MM-DD") : "",
      fecha_expedicion: h.fecha_expedicion ? dayjs(h.fecha_expedicion).format("YYYY-MM-DD") : "",
      telefono:         h.telefono         || "",
      email:            h.email            || "",
      nacionalidad:     h.nacionalidad     || "",
      ciudad:           h.ciudad           || "",
      direccion:        h.direccion        || "",
    });
    setModo("ver"); setTabActiva("datos");
    setErrorModal(""); setOkModal("");
    setEstadias([]);
    setShowModal(true);
    cargarEstadias(h.id);
  };

    
  // Abrir modal NUEVO
    
  const abrirNuevo = () => {
    setHuespedSel(null);
    setForm(FORM_VACIO);
    setModo("nuevo"); setTabActiva("datos");
    setErrorModal(""); setOkModal("");
    setEstadias([]);
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setHuespedSel(null);
    setErrorModal(""); setOkModal("");
  };

  const handleForm = (campo, valor) => setForm(p => ({ ...p, [campo]: valor }));

    
  // Guardar
    
  const guardar = async () => {
    setErrorModal(""); setOkModal("");
    if (!form.nombres.trim()) { setErrorModal("Nombres es obligatorio."); return; }
    if (!form.primer_apellido.trim()) { setErrorModal("Primer apellido es obligatorio."); return; }

    setGuardando(true);
    try {
      if (modo === "nuevo") {
        await axios.post(`${API}/api/huespedes`, form, { headers: getAuthHeaders() });
        setOkModal("Huésped creado correctamente.");
        await cargar({ page:1 });
        setTimeout(cerrarModal, 1200);
      } else {
        await axios.put(
          `${API}/api/huespedes/${huespedSel.id}`, form, { headers: getAuthHeaders() });
        setOkModal("Datos actualizados correctamente.");
        setModo("ver");
        await cargar({ page });
      }
    } catch (e) {
      setErrorModal(e?.response?.data?.message || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const esEditable = modo === "editar" || modo === "nuevo";

    
  // Render
    
  return (
    <div style={{ maxWidth:1200, margin:"0 auto", paddingTop:14, paddingBottom:24 }}>
      <Card className="shadow-sm">
        <Card.Body>

          {/* ── Cabecera   ─────────── */}
          <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
            <div>
              <h3 className="mb-0">Registro de Huéspedes</h3>
              <div className="text-muted" style={{ fontSize:13 }}>
                {total} huésped(es) registrados
              </div>
            </div>
            <Button variant="primary" size="sm" onClick={abrirNuevo}>
              ➕ Nuevo huésped
            </Button>
          </div>

          {error && <Alert variant="danger" className="py-2">{error}</Alert>}

          {/* ── Filtros   ──────────── */}
          <Row className="g-2 align-items-end mb-3">
            <Col md={7}>
              <Form.Label className="mb-1" style={{ fontSize:13 }}>
                Búsqueda (nombre, documento, email, teléfono)
              </Form.Label>
              <Form.Control
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={e => e.key === "Enter" && buscar()}
                placeholder="Ej: García / 1006 / correo@..."
              />
            </Col>
            <Col md={3} className="d-flex gap-2">
              <Button variant="primary" className="w-100" onClick={buscar} disabled={cargando}>
                Buscar
              </Button>
              <Button variant="outline-secondary" className="w-100" onClick={limpiar} disabled={cargando}>
                Limpiar
              </Button>
            </Col>
          </Row>

          {/* ── Tabla   ────────────── */}
          {cargando ? (
            <div className="d-flex justify-content-center py-4"><Spinner animation="border" /></div>
          ) : items.length === 0 ? (
            <Alert variant="warning">No hay huéspedes que coincidan.</Alert>
          ) : (
            <div className="table-responsive">
              <Table striped hover size="sm" className="align-middle mb-2">
                <thead className="table-light">
                  <tr>
                    <th>Nombre</th><th>Documento</th><th>Teléfono</th>
                    <th>Email</th><th>Estadías</th><th>Última estadía</th>
                    <th style={{ width:110 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(h => (
                    <tr key={h.id}>
                      <td className="fw-semibold">{nombreMostrar(h)}</td>
                      <td>
                        {h.tipo_documento && (
                          <Badge bg="light" text="dark" className="me-1">{h.tipo_documento}</Badge>
                        )}
                        {h.documento || "—"}
                      </td>
                      <td>{h.telefono || "—"}</td>
                      <td style={{ maxWidth:160 }}>
                        <small className="text-muted">
                          {h.email
                            ? h.email.length > 24 ? h.email.slice(0,24)+"..." : h.email
                            : "—"}
                        </small>
                      </td>
                      <td className="text-center">
                        <Badge bg={h.total_estadias > 0 ? "success" : "secondary"}>
                          {h.total_estadias}
                        </Badge>
                      </td>
                      <td>
                        {h.ultima_estadia
                          ? dayjs(h.ultima_estadia).format("DD/MM/YYYY")
                          : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        <Button variant="outline-primary" size="sm" onClick={() => abrirVer(h)}>
                          Ver / Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          {/* ── Paginación   ───────── */}
          <div className="d-flex justify-content-between align-items-center">
            <div className="text-muted" style={{ fontSize:13 }}>
              Página {page} de {totalPages} — {total} resultados
            </div>
            <div className="d-flex gap-2">
              <Button size="sm" variant="outline-secondary"
                disabled={cargando || page <= 1}
                onClick={() => cargar({ page: page - 1 })}>
                ← Anterior
              </Button>
              <Button size="sm" variant="outline-secondary"
                disabled={cargando || page >= totalPages}
                onClick={() => cargar({ page: page + 1 })}>
                Siguiente →
              </Button>
            </div>
          </div>

        </Card.Body>
      </Card>

      {/* ══════════════════════════════════════════════════════ */}
      {/* MODAL VER / EDITAR / NUEVO                          */}
      {/* ══════════════════════════════════════════════════════ */}
      <Modal show={showModal} onHide={cerrarModal} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {modo === "nuevo"  ? "➕ Nuevo huésped"
             : modo === "editar" ? `✏️ Editar — ${nombreMostrar(huespedSel || {})}`
             : `👤 ${nombreMostrar(huespedSel || {})}`}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {/* Pestañas solo en ver/editar */}
          {modo !== "nuevo" && (
            <Nav variant="tabs" className="mb-3" activeKey={tabActiva}
              onSelect={k => setTabActiva(k)}>
              <Nav.Item><Nav.Link eventKey="datos">📋 Datos personales</Nav.Link></Nav.Item>
              <Nav.Item><Nav.Link eventKey="estadias">🏨 Historial de estadías</Nav.Link></Nav.Item>
            </Nav>
          )}

          {/* ── Tab datos / formulario nuevo ── */}
          {(tabActiva === "datos" || modo === "nuevo") && (
            <div>
              {errorModal && (
                <Alert variant="danger" className="py-2 mb-3" style={{ fontSize:13 }}>
                  {errorModal}
                </Alert>
              )}
              {okModal && (
                <Alert variant="success" className="py-2 mb-3" style={{ fontSize:13 }}>
                  {okModal}
                </Alert>
              )}

              <Row className="g-2">
                <Col md={4}>
                  <Form.Label>Nombres *</Form.Label>
                  <Form.Control value={form.nombres} disabled={!esEditable}
                    onChange={e => handleForm("nombres", e.target.value)} />
                </Col>
                <Col md={4}>
                  <Form.Label>Primer apellido *</Form.Label>
                  <Form.Control value={form.primer_apellido} disabled={!esEditable}
                    onChange={e => handleForm("primer_apellido", e.target.value)} />
                </Col>
                <Col md={4}>
                  <Form.Label>Segundo apellido</Form.Label>
                  <Form.Control value={form.segundo_apellido} disabled={!esEditable}
                    onChange={e => handleForm("segundo_apellido", e.target.value)} />
                </Col>

                <Col md={3}>
                  <Form.Label>Tipo documento</Form.Label>
                  <Form.Select value={form.tipo_documento} disabled={!esEditable}
                    onChange={e => handleForm("tipo_documento", e.target.value)}>
                    <option value="">Seleccione...</option>
                    {TIPOS_DOC.map(t => <option key={t} value={t}>{t}</option>)}
                  </Form.Select>
                </Col>
                <Col md={5}>
                  <Form.Label>N° Documento</Form.Label>
                  <Form.Control value={form.documento} disabled={!esEditable}
                    onChange={e => handleForm("documento", e.target.value)}
                    placeholder="Número de documento" />
                </Col>
                <Col md={4}>
                  <Form.Label>Fecha nacimiento</Form.Label>
                  <Form.Control type="date" value={form.fecha_nacimiento} disabled={!esEditable}
                    onChange={e => handleForm("fecha_nacimiento", e.target.value)} />
                </Col>

                <Col md={4}>
                  <Form.Label>Fecha expedición doc.</Form.Label>
                  <Form.Control type="date" value={form.fecha_expedicion} disabled={!esEditable}
                    onChange={e => handleForm("fecha_expedicion", e.target.value)} />
                </Col>
                <Col md={4}>
                  <Form.Label>Teléfono</Form.Label>
                  <Form.Control value={form.telefono} disabled={!esEditable}
                    onChange={e => handleForm("telefono", e.target.value)}
                    placeholder="Ej: 3001234567" />
                </Col>
                <Col md={4}>
                  <Form.Label>Email</Form.Label>
                  <Form.Control type="email" value={form.email} disabled={!esEditable}
                    onChange={e => handleForm("email", e.target.value)}
                    placeholder="correo@..." />
                </Col>

                <Col md={4}>
                  <Form.Label>Nacionalidad</Form.Label>
                  <Form.Select value={form.nacionalidad} disabled={!esEditable}
                    onChange={e => handleForm("nacionalidad", e.target.value)}>
                    <option value="">Seleccione...</option>
                    {NACIONALIDADES.map(n => <option key={n} value={n}>{n}</option>)}
                  </Form.Select>
                </Col>
                <Col md={4}>
                  <Form.Label>Ciudad de residencia</Form.Label>
                  <Form.Control value={form.ciudad} disabled={!esEditable}
                    onChange={e => handleForm("ciudad", e.target.value)}
                    placeholder="Ciudad" />
                </Col>
                <Col md={4}>
                  <Form.Label>Dirección</Form.Label>
                  <Form.Control value={form.direccion} disabled={!esEditable}
                    onChange={e => handleForm("direccion", e.target.value)}
                    placeholder="Dirección completa" />
                </Col>
              </Row>

              {modo === "ver" && huespedSel && (
                <div className="mt-3 text-muted" style={{ fontSize:12 }}>
                  Registrado: {dayjs(huespedSel.created_at).format("DD/MM/YYYY")}
                  {huespedSel.updated_at && huespedSel.updated_at !== huespedSel.created_at &&
                    ` — Actualizado: ${dayjs(huespedSel.updated_at).format("DD/MM/YYYY")}`}
                </div>
              )}
            </div>
          )}

          {/* ── Tab historial de estadías ── */}
          {tabActiva === "estadias" && modo !== "nuevo" && (
            <div>
              {cargandoEst ? (
                <div className="d-flex justify-content-center py-3"><Spinner animation="border" /></div>
              ) : estadias.length === 0 ? (
                <Alert variant="info" className="py-2">
                  Este huésped no tiene estadías registradas aún.
                </Alert>
              ) : (
                <>
                  <div className="mb-2 text-muted" style={{ fontSize:13 }}>
                    {estadias.length} estadía(s) registradas
                  </div>
                  <div className="table-responsive">
                    <Table hover size="sm" className="align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>#</th><th>Habitación</th><th>Ingreso</th>
                          <th>Salida</th><th>Noches</th><th>Plan</th>
                          <th>Estado</th><th>Rol</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estadias.map(e => (
                          <tr key={e.reserva_id}>
                            <td className="text-muted" style={{ fontSize:12 }}>#{e.reserva_id}</td>
                            <td>
                              <span className="fw-semibold">Hab. {e.habitacion_numero}</span>{" "}
                              <small className="text-muted">— {e.habitacion_tipo}</small>
                            </td>
                            <td>{dayjs(e.fecha_inicio).format("DD/MM/YY")}</td>
                            <td>{dayjs(e.fecha_fin).format("DD/MM/YY")}</td>
                            <td className="text-center">{e.noches}</td>
                            <td><small>{e.plan || "—"}</small></td>
                            <td>
                              <Badge bg={estadoColor(e.estado)}>{estadoLabel(e.estado)}</Badge>
                            </td>
                            <td>
                              <Badge bg={e.rol === "titular" ? "primary" : "secondary"}>
                                {e.rol === "titular" ? "Titular" : "Acompañante"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer>
          {modo === "ver" && (<>
            <Button variant="secondary" onClick={cerrarModal}>Cerrar</Button>
            <Button variant="primary"
              onClick={() => { setModo("editar"); setErrorModal(""); setOkModal(""); }}>
              ✏️ Editar datos
            </Button>
          </>)}
          {modo === "editar" && (<>
            <Button variant="secondary" disabled={guardando}
              onClick={() => { setModo("ver"); setErrorModal(""); setOkModal(""); cargar({page}); }}>
              Cancelar
            </Button>
            <Button variant="success" onClick={guardar} disabled={guardando}>
              {guardando
                ? <><Spinner animation="border" size="sm" className="me-2" />Guardando...</>
                : "Guardar cambios"}
            </Button>
          </>)}
          {modo === "nuevo" && (<>
            <Button variant="secondary" onClick={cerrarModal} disabled={guardando}>Cancelar</Button>
            <Button variant="primary" onClick={guardar} disabled={guardando}>
              {guardando
                ? <><Spinner animation="border" size="sm" className="me-2" />Guardando...</>
                : "Crear huésped"}
            </Button>
          </>)}
        </Modal.Footer>
      </Modal>
    </div>
  );
}