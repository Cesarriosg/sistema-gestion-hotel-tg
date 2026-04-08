// src/pages/Planes.jsx
// Gestión de planes tarifarios: EP, CP, MAP, AP, GK, etc.
// Un plan es un código + descripción. Las tarifas asignan precio a Plan + Tipo de habitación.

import { useEffect, useState, useCallback } from "react";
import { Card, Table, Button, Badge, Form, Modal, Alert, Spinner, Row, Col } from "react-bootstrap";
import api from "../services/api";

const EJEMPLOS = [
  { codigo: "EP",  descripcion: "European Plan — Solo alojamiento" },
  { codigo: "CP",  descripcion: "Continental Plan — Alojamiento + desayuno" },
  { codigo: "MAP", descripcion: "Modified American Plan — Alojamiento + desayuno + cena" },
  { codigo: "AP",  descripcion: "American Plan — Todo incluido" },
];

export default function Planes() {
  const [planes,    setPlanes]    = useState([]);
  const [cargando,  setCargando]  = useState(false);
  const [error,     setError]     = useState("");

  // Modal crear/editar
  const [showModal,  setShowModal]  = useState(false);
  const [modo,       setModo]       = useState("crear"); // "crear" | "editar"
  const [form,       setForm]       = useState({ codigo: "", descripcion: "" });
  const [codigoEdit, setCodigoEdit] = useState("");
  const [guardando,  setGuardando]  = useState(false);
  const [errModal,   setErrModal]   = useState("");
  const [okModal,    setOkModal]    = useState("");

  // Modal borrar
  const [showBorrar,   setShowBorrar]   = useState(false);
  const [planBorrar,   setPlanBorrar]   = useState(null);
  const [borrando,     setBorrando]     = useState(false);
  const [errBorrar,    setErrBorrar]    = useState("");

  const cargar = useCallback(async () => {
    setCargando(true); setError("");
    try {
      const { data } = await api.get("/planes");
      setPlanes(data || []);
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudieron cargar los planes.");
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirCrear = () => {
    setForm({ codigo: "", descripcion: "" });
    setModo("crear"); setCodigoEdit("");
    setErrModal(""); setOkModal("");
    setShowModal(true);
  };

  const abrirEditar = (p) => {
    setForm({ codigo: p.codigo, descripcion: p.descripcion || "" });
    setModo("editar"); setCodigoEdit(p.codigo);
    setErrModal(""); setOkModal("");
    setShowModal(true);
  };

  const guardar = async () => {
    setErrModal(""); setOkModal("");
    if (!form.codigo.trim()) return setErrModal("El código del plan es obligatorio.");
    setGuardando(true);
    try {
      if (modo === "crear") {
        await api.post("/planes", { codigo: form.codigo.trim(), descripcion: form.descripcion.trim() });
        setOkModal("Plan creado correctamente.");
      } else {
        await api.put(`/planes/${codigoEdit}`, { descripcion: form.descripcion.trim() });
        setOkModal("Plan actualizado.");
      }
      await cargar();
      setTimeout(() => setShowModal(false), 800);
    } catch (e) {
      setErrModal(e?.response?.data?.message || "No se pudo guardar.");
    } finally { setGuardando(false); }
  };

  const toggleActivo = async (p) => {
    try {
      await api.put(`/planes/${p.codigo}`, { activo: !p.activo });
      await cargar();
    } catch (e) {
      alert(e?.response?.data?.message || "No se pudo cambiar el estado.");
    }
  };

  const confirmarBorrar = async () => {
    setBorrando(true); setErrBorrar("");
    try {
      await api.delete(`/planes/${planBorrar.codigo}`);
      setShowBorrar(false);
      await cargar();
    } catch (e) {
      setErrBorrar(e?.response?.data?.message || "No se pudo eliminar.");
    } finally { setBorrando(false); }
  };

  const usarEjemplo = (ej) => {
    setForm({ codigo: ej.codigo, descripcion: ej.descripcion });
    setErrModal("");
  };

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", paddingTop: 14, paddingBottom: 24 }}>
      <Card className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <h3 className="mb-0">Planes tarifarios</h3>
              <div className="text-muted" style={{ fontSize: 13 }}>
                Define los planes del hotel (EP, CP, MAP…). Luego asigna precios en la sección Tarifas.
              </div>
            </div>
            <Button variant="primary" onClick={abrirCrear}>+ Nuevo plan</Button>
          </div>

          {error && <Alert variant="danger" className="py-2">{error}</Alert>}

          {/* Explicación mecánica */}
          <Alert variant="info" className="py-2 mb-3" style={{ fontSize: 13 }}>
            <strong>¿Cómo funciona?</strong> Un plan define el tipo de servicio (ej: solo alojamiento, con desayuno, etc.).
            Las <strong>tarifas</strong> asignan un precio por noche a cada combinación de <em>Plan + Tipo de habitación + Temporada</em>.
            Al crear una reserva se elige la habitación y el plan; el sistema busca la tarifa vigente para calcular el total.
          </Alert>

          {cargando ? (
            <div className="text-center py-4"><Spinner animation="border" /></div>
          ) : planes.length === 0 ? (
            <Alert variant="warning">
              No hay planes registrados. Crea uno para poder asignar tarifas y realizar reservas.
            </Alert>
          ) : (
            <Table striped hover size="sm" className="align-middle">
              <thead className="table-dark">
                <tr>
                  <th>Código</th>
                  <th>Descripción</th>
                  <th>Estado</th>
                  <th style={{ width: 130 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {planes.map(p => (
                  <tr key={p.codigo}>
                    <td><Badge bg="primary" style={{ fontSize: 13 }}>{p.codigo}</Badge></td>
                    <td>{p.descripcion || <span className="text-muted">Sin descripción</span>}</td>
                    <td>
                      <Badge bg={p.activo ? "success" : "secondary"}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                    <td>
                      <div className="d-flex gap-1">
                        <Button size="sm" variant="outline-primary" onClick={() => abrirEditar(p)}>
                          Editar
                        </Button>
                        <Button size="sm" variant={p.activo ? "outline-secondary" : "outline-success"}
                          onClick={() => toggleActivo(p)}>
                          {p.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button size="sm" variant="outline-danger"
                          onClick={() => { setPlanBorrar(p); setErrBorrar(""); setShowBorrar(true); }}>
                          Eliminar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>

      {/* ══ MODAL CREAR / EDITAR ══ */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{modo === "crear" ? "Nuevo plan" : `Editar plan ${codigoEdit}`}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {errModal && <Alert variant="danger" className="py-2 mb-3">{errModal}</Alert>}
          {okModal  && <Alert variant="success" className="py-2 mb-3">{okModal}</Alert>}

          <Row className="g-3">
            <Col md={4}>
              <Form.Label>Código del plan *</Form.Label>
              <Form.Control
                value={form.codigo}
                onChange={e => setForm(p => ({ ...p, codigo: e.target.value.toUpperCase() }))}
                placeholder="Ej: EP, CP, MAP"
                maxLength={20}
                disabled={modo === "editar"}
              />
              {modo === "editar" && (
                <div className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>
                  El código no se puede cambiar.
                </div>
              )}
            </Col>
            <Col md={8}>
              <Form.Label>Descripción</Form.Label>
              <Form.Control
                value={form.descripcion}
                onChange={e => setForm(p => ({ ...p, descripcion: e.target.value }))}
                placeholder="Ej: Solo alojamiento, sin comidas"
                maxLength={150}
              />
            </Col>
          </Row>

          {modo === "crear" && (
            <div className="mt-3">
              <div className="text-muted mb-2" style={{ fontSize: 12 }}>Ejemplos comunes (clic para usar):</div>
              <div className="d-flex flex-wrap gap-2">
                {EJEMPLOS.map(ej => (
                  <button key={ej.codigo} onClick={() => usarEjemplo(ej)}
                    style={{ background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: 6,
                      padding: "4px 10px", fontSize: 12, cursor: "pointer", color: "#1d4ed8", fontWeight: 600 }}>
                    {ej.codigo}
                  </button>
                ))}
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowModal(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? <><Spinner animation="border" size="sm" className="me-2" />Guardando...</> : modo === "crear" ? "Crear plan" : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ══ MODAL BORRAR ══ */}
      <Modal show={showBorrar} onHide={() => setShowBorrar(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title>Eliminar plan</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>¿Eliminar el plan <strong>{planBorrar?.codigo}</strong>?</p>
          <p className="text-muted" style={{ fontSize: 13 }}>
            Solo se puede eliminar si no tiene tarifas ni reservas asociadas.
          </p>
          {errBorrar && <Alert variant="danger" className="py-2">{errBorrar}</Alert>}
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
