// src/pages/Promociones.jsx — HU-PS5 / HU-PS6
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";
import {
  Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table,
} from "react-bootstrap";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";
const getAuth = () => {
  const t = localStorage.getItem("token");
  return t ? { headers: { Authorization: `Bearer ${t}` } } : {};
};

const fmtF = (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "—");
const money = (v) =>
  Number(v || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const TIPOS = [
  { value: "porcentaje",   label: "Descuento porcentual (%)" },
  { value: "monto_fijo",   label: "Descuento monto fijo (COP)" },
  { value: "noches_gratis",label: "Noches gratis" },
];

const FORM_VACIO = {
  nombre: "", descripcion: "", tipo: "porcentaje", valor: "",
  min_noches: 1, plan: "", tipo_habitacion: "",
  fecha_inicio: "", fecha_fin: "",
};

const tipoLabel = (tipo) => TIPOS.find(t => t.value === tipo)?.label || tipo;
const tipoColor = (tipo) => tipo === "porcentaje" ? "primary" : tipo === "monto_fijo" ? "success" : "warning";

export default function Promociones() {
  const [promos,    setPromos]    = useState([]);
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modo,      setModo]      = useState("crear"); // "crear" | "editar"
  const [promoSel,  setPromoSel]  = useState(null);
  const [form,      setForm]      = useState(FORM_VACIO);
  const [guardando, setGuardando] = useState(false);
  const [errModal,  setErrModal]  = useState("");

  const [planes,    setPlanes]    = useState([]);
  const [tipos,     setTipos]     = useState([]);

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const { data } = await axios.get(`${API}/api/promociones`, getAuth());
      setPromos(data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudieron cargar las promociones.");
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    axios.get(`${API}/api/planes`, getAuth())
      .then(r => setPlanes((r.data || []).filter(p => p.activo)))
      .catch(() => {});
    axios.get(`${API}/api/tipos-habitacion`, getAuth())
      .then(r => setTipos((r.data || []).filter(t => t.activo)))
      .catch(() => {});
  }, []);

  const hf = (campo, val) => setForm(p => ({ ...p, [campo]: val }));

  const abrirCrear = () => {
    setForm(FORM_VACIO); setModo("crear"); setPromoSel(null);
    setErrModal(""); setShowModal(true);
  };

  const abrirEditar = (p) => {
    setForm({
      nombre:          p.nombre || "",
      descripcion:     p.descripcion || "",
      tipo:            p.tipo || "porcentaje",
      valor:           p.valor || "",
      min_noches:      p.min_noches || 1,
      plan:            p.plan || "",
      tipo_habitacion: p.tipo_habitacion || "",
      fecha_inicio:    p.fecha_inicio ? dayjs(p.fecha_inicio).format("YYYY-MM-DD") : "",
      fecha_fin:       p.fecha_fin    ? dayjs(p.fecha_fin).format("YYYY-MM-DD")    : "",
    });
    setModo("editar"); setPromoSel(p); setErrModal(""); setShowModal(true);
  };

  const guardar = async () => {
    setErrModal("");
    if (!form.nombre.trim()) { setErrModal("El nombre es obligatorio."); return; }
    if (!form.valor || Number(form.valor) <= 0) { setErrModal("El valor debe ser mayor a 0."); return; }
    setGuardando(true);
    try {
      if (modo === "crear") {
        await axios.post(`${API}/api/promociones`, form, getAuth());
      } else {
        await axios.put(`${API}/api/promociones/${promoSel.id}`, form, getAuth());
      }
      setShowModal(false);
      await cargar();
    } catch (e) {
      setErrModal(e?.response?.data?.message || "Error al guardar.");
    } finally { setGuardando(false); }
  };

  const toggleActiva = async (p) => {
    try {
      await axios.patch(`${API}/api/promociones/${p.id}/activa`,
        { activa: !p.activa }, getAuth()
      );
      await cargar();
    } catch (e) {
      alert(e?.response?.data?.message || "Error al cambiar estado.");
    }
  };

  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar la promoción "${p.nombre}"?`)) return;
    try {
      await axios.delete(`${API}/api/promociones/${p.id}`, getAuth());
      await cargar();
    } catch (e) {
      alert(e?.response?.data?.message || "Error al eliminar.");
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", paddingTop: 16, paddingBottom: 32 }}>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h3 className="mb-0">Promociones y Descuentos</h3>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Configura descuentos, noches gratis o precios especiales por temporada.
          </div>
        </div>
        <Button variant="primary" onClick={abrirCrear}>+ Nueva promoción</Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {cargando ? (
        <div className="text-center py-5"><Spinner animation="border" /></div>
      ) : promos.length === 0 ? (
        <Card><Card.Body className="text-center text-muted py-5">
          No hay promociones creadas. Crea la primera con el botón de arriba.
        </Card.Body></Card>
      ) : (
        <Card>
          <Card.Body className="p-0">
            <Table hover className="align-middle mb-0">
              <thead className="table-dark">
                <tr>
                  <th>Nombre</th><th>Tipo</th><th>Valor</th><th>Mín. noches</th>
                  <th>Plan</th><th>Tipo hab.</th><th>Vigencia</th><th>Estado</th><th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {promos.map(p => (
                  <tr key={p.id} style={{ opacity: p.activa ? 1 : 0.55 }}>
                    <td>
                      <div className="fw-semibold">{p.nombre}</div>
                      {p.descripcion && (
                        <div className="text-muted" style={{ fontSize: 12 }}>{p.descripcion}</div>
                      )}
                    </td>
                    <td>
                      <Badge bg={tipoColor(p.tipo)} style={{ fontSize: 11 }}>
                        {tipoLabel(p.tipo)}
                      </Badge>
                    </td>
                    <td className="fw-semibold">
                      {p.tipo === "porcentaje"
                        ? `${p.valor}%`
                        : p.tipo === "monto_fijo"
                        ? money(p.valor)
                        : `${p.valor} noche(s)`}
                    </td>
                    <td className="text-center">{p.min_noches || 1}</td>
                    <td>{p.plan || <span className="text-muted">Todos</span>}</td>
                    <td>{p.tipo_habitacion || <span className="text-muted">Todos</span>}</td>
                    <td style={{ fontSize: 12 }}>
                      {p.fecha_inicio || p.fecha_fin
                        ? `${fmtF(p.fecha_inicio)} → ${fmtF(p.fecha_fin)}`
                        : <span className="text-muted">Sin límite</span>}
                    </td>
                    <td>
                      <Badge bg={p.activa ? "success" : "secondary"}>
                        {p.activa ? "Activa" : "Inactiva"}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-1 flex-wrap">
                        <Button size="sm" variant="outline-primary" onClick={() => abrirEditar(p)}>
                          Editar
                        </Button>
                        <Button size="sm"
                          variant={p.activa ? "outline-warning" : "outline-success"}
                          onClick={() => toggleActiva(p)}>
                          {p.activa ? "Desactivar" : "Activar"}
                        </Button>
                        <Button size="sm" variant="outline-danger" onClick={() => eliminar(p)}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}

      {/* ── Modal crear / editar ── */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>{modo === "crear" ? "Nueva promoción" : `Editar — ${promoSel?.nombre}`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errModal && <Alert variant="danger" className="py-2">{errModal}</Alert>}
          <Row className="g-3">
            <Col md={6}>
              <Form.Label>Nombre *</Form.Label>
              <Form.Control value={form.nombre} onChange={e => hf("nombre", e.target.value)}
                placeholder="Ej: Temporada baja 20%" />
            </Col>
            <Col md={6}>
              <Form.Label>Tipo de descuento *</Form.Label>
              <Form.Select value={form.tipo} onChange={e => hf("tipo", e.target.value)}>
                {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Form.Select>
            </Col>

            <Col md={4}>
              <Form.Label>
                Valor *
                <small className="text-muted ms-1">
                  {form.tipo === "porcentaje" ? "(%)" : form.tipo === "monto_fijo" ? "(COP)" : "(noches)"}
                </small>
              </Form.Label>
              <Form.Control type="number" min={0} value={form.valor}
                onChange={e => hf("valor", e.target.value)} placeholder="Ej: 15" />
            </Col>
            <Col md={4}>
              <Form.Label>Mínimo de noches</Form.Label>
              <Form.Control type="number" min={1} value={form.min_noches}
                onChange={e => hf("min_noches", e.target.value)} />
            </Col>
            <Col md={4}>
              <Form.Label>Aplica al plan</Form.Label>
              <Form.Select value={form.plan} onChange={e => hf("plan", e.target.value)}>
                <option value="">Todos los planes</option>
                {planes.map(p => <option key={p.codigo} value={p.codigo}>{p.codigo}{p.descripcion ? ` — ${p.descripcion}` : ""}</option>)}
              </Form.Select>
            </Col>

            <Col md={4}>
              <Form.Label>Aplica al tipo de habitación</Form.Label>
              <Form.Select value={form.tipo_habitacion} onChange={e => hf("tipo_habitacion", e.target.value)}>
                <option value="">Todos los tipos</option>
                {tipos.map(t => <option key={t.id} value={t.nombre}>{t.nombre} ({t.codigo})</option>)}
              </Form.Select>
            </Col>
            <Col md={4}>
              <Form.Label>Fecha inicio vigencia</Form.Label>
              <Form.Control type="date" value={form.fecha_inicio}
                onChange={e => hf("fecha_inicio", e.target.value)} />
            </Col>
            <Col md={4}>
              <Form.Label>Fecha fin vigencia</Form.Label>
              <Form.Control type="date" value={form.fecha_fin}
                onChange={e => hf("fecha_fin", e.target.value)} />
            </Col>

            <Col md={12}>
              <Form.Label>Descripción / notas internas</Form.Label>
              <Form.Control as="textarea" rows={2} value={form.descripcion}
                onChange={e => hf("descripcion", e.target.value)}
                placeholder="Ej: Aplica para reservas realizadas antes del 30 de noviembre" />
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)} disabled={guardando}>Cancelar</Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando
              ? <><Spinner animation="border" size="sm" className="me-1" />Guardando...</>
              : modo === "crear" ? "Crear promoción" : "Guardar cambios"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
