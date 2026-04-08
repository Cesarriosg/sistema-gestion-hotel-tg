
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";
import {
  Card, Table, Button, Badge, Form, Row, Col,
  Modal, Alert, Spinner,
} from "react-bootstrap";

const API = "http://localhost:4000";
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const money = (v) => Number(v).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const TEMPORADAS = ["base", "alta", "especial"];
const temporadaLabel = (t) => ({ base: "Base", alta: "Alta", especial: "Especial" }[t] || t);
const temporadaColor = (t) => ({ base: "secondary", alta: "warning", especial: "info" }[t] || "light");

const FORM_VACIO = {
  tipo_habitacion: "", plan: "C1", precio: "",
  fecha_inicio: "", fecha_fin: "", temporada: "base",
};

export default function Tarifas() {
  const [tarifas,   setTarifas]   = useState([]);
  const [tipos,     setTipos]     = useState([]);
  const [planes,    setPlanes]    = useState([]);
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState("");

  // Filtros
  const [fPlan,  setFPlan]  = useState("");
  const [fTipo,  setFTipo]  = useState("");
  const [fVig,   setFVig]   = useState(""); // "true" | "false" | ""

  // Modal
  const [showModal,  setShowModal]  = useState(false);
  const [modoModal,  setModoModal]  = useState("crear"); // "crear" | "editar"
  const [form,       setForm]       = useState(FORM_VACIO);
  const [guardando,  setGuardando]  = useState(false);
  const [errorModal, setErrorModal] = useState("");
  const [okModal,    setOkModal]    = useState("");
  const [editId,     setEditId]     = useState(null);

  // Confirmar borrar
  const [showBorrar,  setShowBorrar]  = useState(false);
  const [borrandoId,  setBorrandoId]  = useState(null);
  const [borrando,    setBorrando]    = useState(false);
  const [errorBorrar, setErrorBorrar] = useState("");

  // ── Carga ───────────────────────────────────────────────────────────────
  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const params = {};
      if (fPlan)  params.plan            = fPlan;
      if (fTipo)  params.tipo_habitacion = fTipo;
      if (fVig)   params.vigente         = fVig;
      const { data } = await axios.get(`${API}/api/tarifas`, { params, headers: getAuthHeaders() });
      setTarifas(data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudieron cargar las tarifas.");
    } finally {
      setCargando(false);
    }
  }, [fPlan, fTipo, fVig]);

  const cargarTipos = async () => {
    try {
      const { data } = await axios.get(`${API}/api/tipos-habitacion`, { headers: getAuthHeaders() });
      setTipos((data || []).filter(t => t.activo));
    } catch { setTipos([]); }
  };

  const cargarPlanes = async () => {
    try {
      const { data } = await axios.get(`${API}/api/planes`, { headers: getAuthHeaders() });
      setPlanes((data || []).filter(p => p.activo));
    } catch { setPlanes([]); }
  };

  useEffect(() => { cargar(); cargarTipos(); cargarPlanes(); }, []);  // eslint-disable-line
  const filtrar = () => cargar();

  const hf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // ── Abrir crear ─────────────────────────────────────────────────────────
  const abrirCrear = () => {
    setForm({ ...FORM_VACIO, tipo_habitacion: tipos[0]?.nombre || "" });
    setModoModal("crear"); setEditId(null);
    setErrorModal(""); setOkModal("");
    setShowModal(true);
  };

  // ── Abrir editar ─────────────────────────────────────────────────────────
  const abrirEditar = (t) => {
    setForm({
      tipo_habitacion: t.tipo_habitacion,
      plan:            t.plan,
      precio:          t.precio,
      fecha_inicio:    dayjs(t.fecha_inicio).format("YYYY-MM-DD"),
      fecha_fin:       dayjs(t.fecha_fin).format("YYYY-MM-DD"),
      temporada:       t.temporada || "base",
    });
    setModoModal("editar"); setEditId(t.id);
    setErrorModal(""); setOkModal("");
    setShowModal(true);
  };

  // ── Guardar ──────────────────────────────────────────────────────────────
  const guardar = async () => {
    setErrorModal(""); setOkModal("");
    if (!form.tipo_habitacion) { setErrorModal("Selecciona el tipo de habitación."); return; }
    if (!form.plan)            { setErrorModal("Selecciona el plan."); return; }
    if (!form.precio || Number(form.precio) <= 0) { setErrorModal("El precio debe ser mayor a 0."); return; }
    if (!form.fecha_inicio)    { setErrorModal("La fecha de inicio es obligatoria."); return; }
    if (!form.fecha_fin)       { setErrorModal("La fecha de fin es obligatoria."); return; }
    if (form.fecha_fin < form.fecha_inicio) { setErrorModal("La fecha fin debe ser posterior al inicio."); return; }

    setGuardando(true);
    try {
      if (modoModal === "crear") {
        await axios.post(`${API}/api/tarifas`, form, { headers: getAuthHeaders() });
        setOkModal("Tarifa creada correctamente.");
      } else {
        await axios.put(`${API}/api/tarifas/${editId}`, form, { headers: getAuthHeaders() });
        setOkModal("Tarifa actualizada correctamente.");
      }
      await cargar();
      setTimeout(() => setShowModal(false), 900);
    } catch (e) {
      setErrorModal(e?.response?.data?.message || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  // ── Borrar ───────────────────────────────────────────────────────────────
  const confirmarBorrar = async () => {
    setBorrando(true); setErrorBorrar("");
    try {
      await axios.delete(`${API}/api/tarifas/${borrandoId}`, { headers: getAuthHeaders() });
      setShowBorrar(false);
      await cargar();
    } catch (e) {
      setErrorBorrar(e?.response?.data?.message || "No se pudo eliminar.");
    } finally {
      setBorrando(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", paddingTop: 14, paddingBottom: 24 }}>
      <Card className="shadow-sm">
        <Card.Body>
          {/* Cabecera */}
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <h3 className="mb-0">💰 Gestión de Tarifas</h3>
              <div className="text-muted" style={{ fontSize: 13 }}>
                Define precios por tipo de habitación, plan y temporada con vigencias de fechas.
              </div>
            </div>
            <Button variant="primary" onClick={abrirCrear}>
              ➕ Nueva tarifa
            </Button>
          </div>

          {error && <Alert variant="danger" className="py-2">{error}</Alert>}

          {/* Filtros */}
          <Row className="g-2 mb-3 align-items-end">
            <Col md={3}>
              <Form.Label className="mb-1">Tipo habitación</Form.Label>
              <Form.Select value={fTipo} onChange={e => setFTipo(e.target.value)}>
                <option value="">Todos</option>
                {tipos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="mb-1">Plan</Form.Label>
              <Form.Select value={fPlan} onChange={e => setFPlan(e.target.value)}>
                <option value="">Todos</option>
                {planes.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo}{p.descripcion ? ` — ${p.descripcion}` : ""}</option>)}
              </Form.Select>
            </Col>
            <Col md={2}>
              <Form.Label className="mb-1">Vigencia</Form.Label>
              <Form.Select value={fVig} onChange={e => setFVig(e.target.value)}>
                <option value="">Todas</option>
                <option value="true">Solo vigentes hoy</option>
              </Form.Select>
            </Col>
            <Col md="auto">
              <Button variant="outline-primary" onClick={filtrar} disabled={cargando}>
                Filtrar
              </Button>
              <Button variant="outline-secondary" className="ms-2"
                onClick={() => { setFPlan(""); setFTipo(""); setFVig(""); setTimeout(cargar, 0); }}>
                Limpiar
              </Button>
            </Col>
          </Row>

          {/* Tabla */}
          {cargando ? (
            <div className="text-center py-4"><Spinner animation="border" /></div>
          ) : tarifas.length === 0 ? (
            <Alert variant="warning">No hay tarifas registradas con esos filtros.</Alert>
          ) : (
            <div className="table-responsive">
              <Table striped hover size="sm" className="align-middle">
                <thead className="table-dark">
                  <tr>
                    <th>Tipo habitación</th>
                    <th>Plan</th>
                    <th>Precio / noche</th>
                    <th>Temporada</th>
                    <th>Desde</th>
                    <th>Hasta</th>
                    <th>Estado</th>
                    <th style={{ width: 110 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tarifas.map(t => (
                    <tr key={t.id}>
                      <td className="fw-semibold">{t.tipo_habitacion}</td>
                      <td><Badge bg="primary">{t.plan}</Badge></td>
                      <td className="fw-bold text-success">{money(t.precio)}</td>
                      <td>
                        <Badge bg={temporadaColor(t.temporada)} text={t.temporada === "alta" ? "dark" : undefined}>
                          {temporadaLabel(t.temporada)}
                        </Badge>
                      </td>
                      <td>{dayjs(t.fecha_inicio).format("DD/MM/YYYY")}</td>
                      <td>{dayjs(t.fecha_fin).format("DD/MM/YYYY")}</td>
                      <td>
                        {t.vigente_hoy
                          ? <Badge bg="success"> Vigente</Badge>
                          : <Badge bg="secondary">Inactiva</Badge>}
                      </td>
                      <td>
                        <div className="d-flex gap-1">
                          <Button size="sm" variant="outline-primary" onClick={() => abrirEditar(t)}>
                            ✏️
                          </Button>
                          <Button size="sm" variant="outline-danger"
                            onClick={() => { setBorrandoId(t.id); setErrorBorrar(""); setShowBorrar(true); }}>
                            🗑️
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {tarifas.length} tarifa(s) — {tarifas.filter(t => t.vigente_hoy).length} vigentes hoy
              </div>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* ══ MODAL CREAR / EDITAR ══════════════════════════════════════════════ */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modoModal === "crear" ? "➕ Nueva tarifa" : "✏️ Editar tarifa"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errorModal && <Alert variant="danger" className="py-2 mb-3">{errorModal}</Alert>}
          {okModal    && <Alert variant="success" className="py-2 mb-3">{okModal}</Alert>}

          <Row className="g-2">
            <Col md={7}>
              <Form.Label>Tipo de habitación *</Form.Label>
              <Form.Select value={form.tipo_habitacion} onChange={e => hf("tipo_habitacion", e.target.value)}>
                <option value="">Seleccione...</option>
                {tipos.map(t => <option key={t.id} value={t.nombre}>{t.nombre} ({t.codigo})</option>)}
              </Form.Select>
            </Col>
            <Col md={5}>
              <Form.Label>Plan *</Form.Label>
              <Form.Select value={form.plan} onChange={e => hf("plan", e.target.value)}>
                <option value="">Seleccione un plan...</option>
                {planes.map(p => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo}{p.descripcion ? ` — ${p.descripcion}` : ""}
                  </option>
                ))}
              </Form.Select>
              {planes.length === 0 && (
                <div className="text-danger mt-1" style={{ fontSize: 12 }}>
                  No hay planes activos. Crea uno en Administración → Planes.
                </div>
              )}
            </Col>

            <Col md={6}>
              <Form.Label>Precio por noche * (COP)</Form.Label>
              <Form.Control
                type="number" min="1" value={form.precio}
                onChange={e => hf("precio", e.target.value)}
                placeholder="Ej: 190000"
              />
            </Col>
            <Col md={6}>
              <Form.Label>Temporada</Form.Label>
              <Form.Select value={form.temporada} onChange={e => hf("temporada", e.target.value)}>
                {TEMPORADAS.map(t => <option key={t} value={t}>{temporadaLabel(t)}</option>)}
              </Form.Select>
            </Col>

            <Col md={6}>
              <Form.Label>Fecha inicio vigencia *</Form.Label>
              <Form.Control
                type="date" value={form.fecha_inicio}
                onChange={e => hf("fecha_inicio", e.target.value)}
              />
            </Col>
            <Col md={6}>
              <Form.Label>Fecha fin vigencia *</Form.Label>
              <Form.Control
                type="date" value={form.fecha_fin}
                min={form.fecha_inicio || undefined}
                onChange={e => hf("fecha_fin", e.target.value)}
              />
            </Col>
          </Row>

          {form.precio && form.fecha_inicio && form.fecha_fin && form.fecha_fin >= form.fecha_inicio && (
            <div className="mt-3 p-2 rounded" style={{ background: "#f0fdf4", fontSize: 13 }}>
              <strong>Resumen:</strong> {form.tipo_habitacion || "—"} · Plan {form.plan} ·{" "}
              {money(Number(form.precio))} por noche · {temporadaLabel(form.temporada)} ·{" "}
              {dayjs(form.fecha_inicio).format("DD/MM/YYYY")} → {dayjs(form.fecha_fin).format("DD/MM/YYYY")} (
              {dayjs(form.fecha_fin).diff(dayjs(form.fecha_inicio), "day") + 1} días)
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowModal(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando
              ? <><Spinner animation="border" size="sm" className="me-2" />Guardando...</>
              : modoModal === "crear" ? "Crear tarifa" : "Guardar cambios"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ══ MODAL CONFIRMAR BORRAR ════════════════════════════════════════════ */}
      <Modal show={showBorrar} onHide={() => setShowBorrar(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title>⚠️ Eliminar tarifa</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Estás seguro de que deseas eliminar esta tarifa? Esta acción no se puede deshacer.</p>
          {errorBorrar && <Alert variant="danger" className="py-2">{errorBorrar}</Alert>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowBorrar(false)} disabled={borrando}>
            Cancelar
          </Button>
          <Button variant="danger" onClick={confirmarBorrar} disabled={borrando}>
            {borrando ? "Eliminando..." : "Sí, eliminar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}