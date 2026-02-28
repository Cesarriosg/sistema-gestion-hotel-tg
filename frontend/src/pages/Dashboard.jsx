// src/pages/Dashboard.jsx
import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";
import { Card, Row, Col, Badge, Spinner, Button, Alert, ProgressBar } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const money = (v) =>
  Number(v || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });

// Tarjeta de KPI
function KpiCard({ label, value, sub, color = "#1a3a5c", bg = "#f8faff" }) {
  return (
    <Card className="h-100 shadow-sm" style={{ background: bg, border: "1px solid #e8edf2" }}>
      <Card.Body style={{ minHeight: 100 }}>
        <div className="text-muted mb-2" style={{ fontSize: 12, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {label}
        </div>
        <div style={{ fontSize: 30, fontWeight: 700, color, lineHeight: 1.1 }}>
          {value}
        </div>
        {sub && (
          <div className="text-muted mt-1" style={{ fontSize: 12 }}>
            {sub}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}

const estadoBadgeColor = (e) =>
  ({ reservada: "primary", ocupada: "success", finalizada: "dark" }[e] || "secondary");

const estadoLabel = (e) =>
  ({ reservada: "Reservadas", ocupada: "Ocupadas", finalizada: "Finalizadas" }[e] || e);

export default function Dashboard() {
  const navigate   = useNavigate();
  const [data,     setData]     = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error,    setError]    = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");
    try {
      const { data: d } = await axios.get(`${API}/api/dashboard`, {
        headers: getAuthHeaders(),
        timeout: 8000,
      });
      setData(d);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || "No se pudo conectar con el servidor.";
      setError(msg);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, []); // eslint-disable-line

  // Auto-refresco cada 3 minutos
  useEffect(() => {
    const id = setInterval(cargar, 180_000);
    return () => clearInterval(id);
  }, [cargar]);

  if (cargando) {
    return (
      <div className="d-flex flex-column align-items-center justify-content-center" style={{ minHeight: 300 }}>
        <Spinner animation="border" variant="primary" />
        <div className="mt-3 text-muted" style={{ fontSize: 14 }}>Cargando informacion del hotel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 600, margin: "40px auto" }}>
        <Alert variant="warning">
          <div className="fw-semibold mb-1">No se pudo cargar el dashboard</div>
          <div style={{ fontSize: 13 }}>{error}</div>
          <div className="mt-2">
            <Button size="sm" variant="outline-secondary" onClick={cargar}>
              Reintentar
            </Button>
          </div>
        </Alert>

        {/* Accesos rapidos siempre visibles aunque falle el dashboard */}
        <Card className="shadow-sm mt-3">
          <Card.Body>
            <div className="fw-semibold mb-3" style={{ fontSize: 15 }}>Accesos rapidos</div>
            <div className="d-flex flex-wrap gap-2">
              <Button variant="outline-primary"   size="sm" onClick={() => navigate("/rack")}>Rack interactivo</Button>
              <Button variant="outline-secondary" size="sm" onClick={() => navigate("/reservas")}>Reservas</Button>
              <Button variant="outline-secondary" size="sm" onClick={() => navigate("/huespedes")}>Huespedes</Button>
              <Button variant="outline-secondary" size="sm" onClick={() => navigate("/facturacion")}>Facturacion</Button>
              <Button variant="outline-secondary" size="sm" onClick={() => navigate("/cierre-dia")}>Cierre de dia</Button>
            </div>
          </Card.Body>
        </Card>
      </div>
    );
  }

  const hab = data?.habitaciones || {};
  const pct = hab.porcentaje_ocupacion || 0;

  const pctColor =
    pct >= 80 ? "#16a34a" :
    pct >= 50 ? "#ca8a04" : "#dc2626";

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>

      {/* Cabecera */}
      <div className="d-flex justify-content-between align-items-center mb-4 flex-wrap gap-2">
        <div>
          <h3 className="mb-0" style={{ fontWeight: 700, color: "#1a1a2e" }}>
            Panel de operaciones
          </h3>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Resumen del hotel segun la fecha operativa del sistema
          </div>
        </div>

        <div className="d-flex align-items-center gap-3">
          {data?.fecha_operativa && (
            <div className="text-end">
              <div className="text-muted" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Fecha operativa
              </div>
              <Badge bg="dark" style={{ fontSize: 13, fontWeight: 500 }}>
                {dayjs(data.fecha_operativa).format("dddd DD/MM/YYYY")}
              </Badge>
            </div>
          )}
          <Button variant="outline-secondary" size="sm" onClick={cargar}>
            Actualizar
          </Button>
        </div>
      </div>

      {/* KPIs principales */}
      <Row className="g-3 mb-4">
        <Col xs={6} md={3}>
          <KpiCard
            label="Ocupacion"
            value={`${pct}%`}
            sub={`${hab.ocupadas || 0} de ${hab.total || 0} habitaciones`}
            color={pctColor}
            bg="#fff"
          />
        </Col>
        <Col xs={6} md={3}>
          <KpiCard
            label="Llegadas hoy"
            value={data?.llegadas_hoy ?? 0}
            sub="Check-ins pendientes"
            color="#1565c0"
            bg="#eff6ff"
          />
        </Col>
        <Col xs={6} md={3}>
          <KpiCard
            label="Salidas hoy"
            value={data?.salidas_hoy ?? 0}
            sub="Check-outs esperados"
            color="#6d28d9"
            bg="#f5f3ff"
          />
        </Col>
        <Col xs={6} md={3}>
          <KpiCard
            label="Ingresos del dia"
            value={money(data?.ingresos_hoy)}
            sub="Pagos registrados hoy"
            color="#15803d"
            bg="#f0fdf4"
          />
        </Col>
      </Row>

      {/* Barra de ocupacion */}
      <Card className="shadow-sm mb-4" style={{ border: "1px solid #e8edf2" }}>
        <Card.Body>
          <div className="d-flex justify-content-between align-items-center mb-2">
            <span className="fw-semibold" style={{ fontSize: 14 }}>
              Estado de habitaciones
            </span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              {hab.disponibles || 0} disponibles &middot; {hab.reservadas || 0} reservadas &middot; {hab.fuera || 0} fuera de servicio
            </span>
          </div>

          {hab.total > 0 ? (
            <ProgressBar style={{ height: 20, borderRadius: 4 }}>
              <ProgressBar
                variant="success"
                now={((hab.ocupadas || 0) / hab.total) * 100}
                label={hab.ocupadas > 0 ? `${hab.ocupadas} Ocupadas` : ""}
                key={1}
              />
              <ProgressBar
                variant="primary"
                now={((hab.reservadas || 0) / hab.total) * 100}
                label={hab.reservadas > 0 ? `${hab.reservadas} Reservadas` : ""}
                key={2}
              />
              <ProgressBar
                variant="secondary"
                now={((hab.fuera || 0) / hab.total) * 100}
                label={hab.fuera > 0 ? `${hab.fuera} F.S.` : ""}
                key={3}
              />
            </ProgressBar>
          ) : (
            <div className="text-muted" style={{ fontSize: 13 }}>Sin habitaciones registradas.</div>
          )}
        </Card.Body>
      </Card>

      {/* Tarjetas secundarias */}
      <Row className="g-3 mb-4">
        <Col md={4}>
          <KpiCard
            label="Huespedes en casa"
            value={data?.huespedes_casa ?? 0}
            sub="Reservas activas ahora"
            color="#0369a1"
            bg="#f0f9ff"
          />
        </Col>
        <Col md={4}>
          <KpiCard
            label="No-shows hoy"
            value={data?.no_shows_hoy ?? 0}
            sub="Reservas marcadas como no-show"
            color="#b91c1c"
            bg="#fef2f2"
          />
        </Col>
        <Col md={4}>
          <KpiCard
            label="Total habitaciones"
            value={hab.total ?? 0}
            sub={`${hab.disponibles ?? 0} disponibles ahora mismo`}
            color="#1a3a5c"
            bg="#f8faff"
          />
        </Col>
      </Row>

      {/* Reservas por estado */}
      {data?.reservas_por_estado?.length > 0 && (
        <Card className="shadow-sm mb-4" style={{ border: "1px solid #e8edf2" }}>
          <Card.Body>
            <div className="fw-semibold mb-3" style={{ fontSize: 14 }}>
              Reservas activas por estado
            </div>
            <div className="d-flex flex-wrap gap-3">
              {data.reservas_por_estado.map((r) => (
                <div
                  key={r.estado}
                  className="d-flex align-items-center gap-2 px-3 py-2 rounded"
                  style={{ background: "#f8faff", border: "1px solid #e8edf2" }}
                >
                  <Badge bg={estadoBadgeColor(r.estado)} style={{ fontSize: 12 }}>
                    {estadoLabel(r.estado)}
                  </Badge>
                  <span className="fw-bold" style={{ fontSize: 22, color: "#1a1a2e" }}>
                    {r.cantidad}
                  </span>
                </div>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Accesos rapidos */}
      <Card className="shadow-sm" style={{ border: "1px solid #e8edf2" }}>
        <Card.Body>
          <div className="fw-semibold mb-3" style={{ fontSize: 14 }}>Accesos rapidos</div>
          <div className="d-flex flex-wrap gap-2">
            <Button variant="outline-primary"   size="sm" onClick={() => navigate("/rack")}>Rack interactivo</Button>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate("/reservas")}>Reservas</Button>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate("/checkin/")}>Check-in</Button>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate("/huespedes")}>Huespedes</Button>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate("/cierre-dia")}>Cierre de dia</Button>
            <Button variant="outline-secondary" size="sm" onClick={() => navigate("/tarifas")}>Tarifas</Button>
          </div>
        </Card.Body>
      </Card>

    </div>
  );
}