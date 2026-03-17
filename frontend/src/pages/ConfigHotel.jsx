// src/pages/ConfigHotel.jsx
// ✅ Configuración del hotel: nombre, dirección, NIT, contacto, fecha operativa
import { useEffect, useState } from "react";
import { Card, Form, Button, Alert, Spinner, Row, Col, Badge } from "react-bootstrap";
import hotelService from "../services/hotelService";


export default function ConfigHotel() {
  const [config,     setConfig]     = useState(null);
  const [cargando,   setCargando]   = useState(true);
  const [guardando,  setGuardando]  = useState(false);
  const [error,      setError]      = useState("");
  const [ok,         setOk]         = useState("");

  const [form, setForm] = useState({
    nombre: "", direccion: "", ciudad: "", telefono: "", email: "", nit: "",
  });

  // Fecha operativa
  const [nuevaFecha,    setNuevaFecha]    = useState("");
  const [guardandoFecha, setGuardandoFecha] = useState(false);
  const [errorFecha,    setErrorFecha]    = useState("");
  const [okFecha,       setOkFecha]       = useState("");

  const cargar = async () => {
    setCargando(true); setError("");
    try {
      const { data } = await hotelService.config();
      setConfig(data);
      setForm({
        nombre:    data.nombre    || "",
        direccion: data.direccion || "",
        ciudad:    data.ciudad    || "",
        telefono:  data.telefono  || "",
        email:     data.email     || "",
        nit:       data.nit       || "",
      });
      setNuevaFecha(
        data.fecha_sistema
          ? new Date(data.fecha_sistema).toISOString().slice(0, 10)
          : ""
      );
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo cargar la configuración.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const hf = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const guardar = async () => {
    setError(""); setOk("");
    if (!form.nombre.trim()) { setError("El nombre del hotel es obligatorio."); return; }
    setGuardando(true);
    try {
      await hotelService.actualizarConfig(form);
      setOk("Configuración guardada correctamente.");
      await cargar();
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo guardar la configuración.");
    } finally {
      setGuardando(false);
    }
  };

  const guardarFecha = async () => {
    setErrorFecha(""); setOkFecha("");
    if (!nuevaFecha) { setErrorFecha("Selecciona una fecha."); return; }
    setGuardandoFecha(true);
    try {
      await hotelService.actualizarFecha({ nueva_fecha: nuevaFecha });
      setOkFecha("Fecha operativa actualizada.");
      await cargar();
    } catch (e) {
      setErrorFecha(e?.response?.data?.message || "No se pudo actualizar la fecha.");
    } finally {
      setGuardandoFecha(false);
    }
  };

  if (cargando) {
    return (
      <div className="text-center py-5">
        <Spinner animation="border" />
        <div className="mt-2 text-muted">Cargando configuración...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", paddingTop: 14, paddingBottom: 32 }}>

      {/* ── Configuración general ─────────────────────────────────────────── */}
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <h4 className="mb-1">🏨 Datos del Hotel</h4>
          <p className="text-muted mb-3" style={{ fontSize: 13 }}>
            Esta información aparece en el PDF del Registro Hotelero y documentos generados.
          </p>

          {error && <Alert variant="danger" className="py-2">{error}</Alert>}
          {ok    && <Alert variant="success" className="py-2">{ok}</Alert>}

          <Row className="g-3">
            <Col md={8}>
              <Form.Label>Nombre del hotel *</Form.Label>
              <Form.Control
                value={form.nombre}
                onChange={e => hf("nombre", e.target.value)}
                placeholder="Ej: Hotel Gran Pacífico"
              />
            </Col>
            <Col md={4}>
              <Form.Label>NIT / RUT</Form.Label>
              <Form.Control
                value={form.nit}
                onChange={e => hf("nit", e.target.value)}
                placeholder="Ej: 900.123.456-7"
              />
            </Col>

            <Col md={8}>
              <Form.Label>Dirección</Form.Label>
              <Form.Control
                value={form.direccion}
                onChange={e => hf("direccion", e.target.value)}
                placeholder="Ej: Calle 10 # 5-23"
              />
            </Col>
            <Col md={4}>
              <Form.Label>Ciudad</Form.Label>
              <Form.Control
                value={form.ciudad}
                onChange={e => hf("ciudad", e.target.value)}
                placeholder="Ej: Tuluá"
              />
            </Col>

            <Col md={6}>
              <Form.Label>Teléfono</Form.Label>
              <Form.Control
                value={form.telefono}
                onChange={e => hf("telefono", e.target.value)}
                placeholder="Ej: 602 225 1234"
              />
            </Col>
            <Col md={6}>
              <Form.Label>Email de contacto</Form.Label>
              <Form.Control
                type="email"
                value={form.email}
                onChange={e => hf("email", e.target.value)}
                placeholder="reservas@hotel.com"
              />
            </Col>
          </Row>

          <div className="mt-3 d-flex justify-content-end">
            <Button variant="primary" onClick={guardar} disabled={guardando}>
              {guardando
                ? <><Spinner animation="border" size="sm" className="me-2" />Guardando...</>
                : "💾 Guardar configuración"}
            </Button>
          </div>
        </Card.Body>
      </Card>

      {/* ── Fecha operativa ───────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <Card.Body>
          <h4 className="mb-1">📅 Fecha Operativa del Hotel</h4>
          <p className="text-muted mb-3" style={{ fontSize: 13 }}>
            La fecha operativa controla el día de referencia del sistema (Rack, Auditoría, etc.).
            Normalmente se avanza automáticamente con el <strong>Cierre de Día</strong>. Cámbiala
            manualmente solo si es estrictamente necesario.
          </p>

          {config?.fecha_sistema && (
            <div className="mb-3">
              <span className="text-muted me-2">Fecha actual del sistema:</span>
              <Badge bg="dark" style={{ fontSize: 14 }}>
                {new Date(config.fecha_sistema).toLocaleDateString("es-CO", {
                  weekday: "long", year: "numeric", month: "long", day: "numeric",
                })}
              </Badge>
            </div>
          )}

          {errorFecha && <Alert variant="danger" className="py-2">{errorFecha}</Alert>}
          {okFecha    && <Alert variant="success" className="py-2">{okFecha}</Alert>}

          <Row className="g-2 align-items-end">
            <Col md={4}>
              <Form.Label>Nueva fecha operativa</Form.Label>
              <Form.Control
                type="date"
                value={nuevaFecha}
                onChange={e => setNuevaFecha(e.target.value)}
              />
            </Col>
            <Col md="auto">
              <Button variant="warning" onClick={guardarFecha} disabled={guardandoFecha}>
                {guardandoFecha
                  ? <><Spinner animation="border" size="sm" className="me-2" />Actualizando...</>
                  : "Actualizar fecha"}
              </Button>
            </Col>
          </Row>

          <Alert variant="warning" className="mt-3 py-2" style={{ fontSize: 13 }}>
            ⚠️ Cambiar la fecha manualmente puede afectar la auditoría nocturna y los cargos de alojamiento.
            Se recomienda usar el módulo de <strong>Cierre de Día</strong> para avanzar la fecha.
          </Alert>
        </Card.Body>
      </Card>
    </div>
  );
}