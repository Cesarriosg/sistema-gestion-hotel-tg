// src/pages/Huespedes.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { Card, Table, Row, Col, Form, Button, Spinner, Alert, Badge } from "react-bootstrap";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const nombreMostrar = (h) => {
  const full = [h.nombres, h.primer_apellido, h.segundo_apellido]
    .map((x) => (x || "").trim())
    .filter(Boolean)
    .join(" ");
  return full || h.nombre || "—";
};

export default function Huespedes() {
  const [q, setQ] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");

  const [page, setPage] = useState(1);
  const limit = 20;

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);

  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const cargar = async (opts = {}) => {
    try {
      setCargando(true);
      setError("");

      const p = opts.page ?? page;
      const qq = opts.q ?? q;
      const fi = opts.fechaIngreso ?? fechaIngreso;

      const r = await axios.get(`${API}/api/huespedes`, {
        params: { q: qq, fecha_ingreso: fi, page: p, limit },
        headers: getAuthHeaders(),
      });

      setItems(r.data.items || []);
      setTotal(Number(r.data.total || 0));
      setPage(Number(r.data.page || p));
    } catch (e) {
      console.error("Error cargando huespedes:", e);
      setError(e?.response?.data?.message || "No se pudieron cargar los huéspedes.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscar = () => cargar({ page: 1 });

  const limpiar = () => {
    setQ("");
    setFechaIngreso("");
    cargar({ q: "", fechaIngreso: "", page: 1 });
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="container" style={{ maxWidth: 1200, paddingTop: 14, paddingBottom: 24 }}>
      <Card className="shadow-sm">
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <div>
              <h3 className="mb-0">Huéspedes</h3>
              <div className="text-muted">Filtra por nombre, documento o fecha de ingreso.</div>
            </div>
            <Badge bg="secondary">{total} encontrados</Badge>
          </div>

          {error && <Alert variant="danger" className="py-2">{error}</Alert>}

          <Row className="g-2 align-items-end">
            <Col md={6}>
              <Form.Label>Búsqueda (nombre o documento)</Form.Label>
              <Form.Control
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Ej: César / 100621..."
              />
            </Col>
            <Col md={3}>
              <Form.Label>Fecha de ingreso</Form.Label>
              <Form.Control
                type="date"
                value={fechaIngreso}
                onChange={(e) => setFechaIngreso(e.target.value)}
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

          <hr />

          {cargando ? (
            <div className="d-flex align-items-center">
              <Spinner animation="border" size="sm" className="me-2" />
              <span>Cargando...</span>
            </div>
          ) : (
            <div className="table-responsive">
              <Table striped bordered hover size="sm" className="mb-2">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Documento</th>
                    <th>Teléfono</th>
                    <th>Email</th>
                    <th>Fecha ingreso</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted">
                        No hay resultados.
                      </td>
                    </tr>
                  ) : (
                    items.map((h) => (
                      <tr key={h.id}>
                        <td>{nombreMostrar(h)}</td>
                        <td>{[h.tipo_documento, h.documento].filter(Boolean).join(" ") || "—"}</td>
                        <td>{h.telefono || "—"}</td>
                        <td>{h.email || "—"}</td>
                        <td>{h.first_ingreso ? dayjs(h.first_ingreso).format("YYYY-MM-DD") : "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </Table>
            </div>
          )}

          {/* Paginación */}
          <div className="d-flex justify-content-between align-items-center">
            <div className="text-muted" style={{ fontSize: 13 }}>
              Página {page} de {totalPages}
            </div>
            <div className="d-flex gap-2">
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={cargando || page <= 1}
                onClick={() => cargar({ page: page - 1 })}
              >
                ← Anterior
              </Button>
              <Button
                size="sm"
                variant="outline-secondary"
                disabled={cargando || page >= totalPages}
                onClick={() => cargar({ page: page + 1 })}
              >
                Siguiente →
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
