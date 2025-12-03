// src/pages/DetalleReserva.jsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { Button, Card, Spinner, Badge } from "react-bootstrap";

export default function DetalleReserva() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [reserva, setReserva] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const cargar = async () => {
      try {
        setLoading(true);
        const res = await axios.get(
          `http://localhost:4000/api/reservas/${id}`
        );
        setReserva(res.data);
      } catch (e) {
        console.error("Error cargando reserva:", e);
        setError("No se pudo cargar la información de la reserva.");
      } finally {
        setLoading(false);
      }
    };
    cargar();
  }, [id]);

  const volver = () => {
    // vuelves al listado de reservas
    navigate("/reservas");
  };

  const badgeEstado = (estado) => {
    const map = {
      reservada: "primary",
      ocupada: "success",
      cancelada: "secondary",
      finalizada: "dark",
      confirmada: "info",
    };
    return <Badge bg={map[estado] || "secondary"}>{estado}</Badge>;
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center mt-5">
        <Spinner animation="border" />
      </div>
    );
  }

  if (error || !reserva) {
    return (
      <div className="container mt-4">
        <p className="text-danger">{error || "Reserva no encontrada."}</p>
        <Button variant="secondary" onClick={volver}>
          Volver
        </Button>
      </div>
    );
  }

  return (
    <div className="container mt-4">
      <Button variant="link" onClick={volver} className="mb-3">
        ⬅ Volver a reservas
      </Button>

      <Card>
        <Card.Header>
          <div className="d-flex justify-content-between align-items-center">
            <span>
              <strong>Reserva #{reserva.id}</strong>
            </span>
            {badgeEstado(reserva.estado)}
          </div>
        </Card.Header>

        <Card.Body>
          <h5>Datos del huésped</h5>
          <p className="mb-1">
            <strong>Nombre:</strong> {reserva.huesped_nombre || "—"}
          </p>
          <p className="mb-1">
            <strong>Documento:</strong> {reserva.documento || "—"}
          </p>
          <p className="mb-3">
            <strong>Teléfono:</strong> {reserva.telefono || "—"}
          </p>

          <h5>Datos de la reserva</h5>
          <p className="mb-1">
            <strong>Habitación:</strong> Hab. {reserva.habitacion_numero} —{" "}
            {reserva.habitacion_tipo}
          </p>
          <p className="mb-1">
            <strong>Ingreso:</strong> {reserva.fecha_inicio}
          </p>
          <p className="mb-3">
            <strong>Salida:</strong> {reserva.fecha_fin}
          </p>

          <h5>Notas</h5>
          <p>{reserva.notas || "Sin notas registradas."}</p>

          <hr />

          <h5>Pagos y facturación (en construcción)</h5>
          <p className="text-muted" style={{ fontSize: "0.9rem" }}>
            Aquí irán los depósitos, pagos aplicados y factura asociada a la
            reserva. Por ahora sólo se muestra el detalle básico.
          </p>

          <div className="d-flex flex-wrap gap-2 mt-2">
            <Button variant="outline-primary" disabled>
              Aplicar depósito (pendiente)
            </Button>
            <Button variant="outline-success" disabled>
              Registrar pago (pendiente)
            </Button>
            <Button variant="outline-dark" disabled>
              Ver / generar factura (pendiente)
            </Button>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
}
