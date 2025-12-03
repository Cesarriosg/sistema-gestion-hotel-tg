// src/pages/Reservas.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import dayjs from "dayjs";
import {
  Table,
  Button,
  Badge,
  Form,
  Row,
  Col,
  Spinner,
  Modal,
} from "react-bootstrap";

const estadoColor = (estado) => {
  switch (estado) {
    case "reservada":
      return "primary";
    case "ocupada":
      return "success";
    case "cancelada":
      return "secondary";
    case "finalizada":
      return "dark";
    default:
      return "light";
  }
};

export default function Reservas() {
  const [reservas, setReservas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // filtros
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todas");

  // edición
  const [showModal, setShowModal] = useState(false);
  const [reservaSel, setReservaSel] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargarReservas = async () => {
    try {
      setCargando(true);
      const r = await axios.get("http://localhost:4000/api/reservas");
      setReservas(r.data);
    } catch (e) {
      console.error("Error cargando reservas:", e);
      alert("Error al cargar reservas.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarReservas();
  }, []);

  const abrirModal = (reserva) => {
    setReservaSel({
      ...reserva,
      fecha_inicio: dayjs(reserva.fecha_inicio).format("YYYY-MM-DD"),
      fecha_fin: dayjs(reserva.fecha_fin).format("YYYY-MM-DD"),
      notas: reserva.notas || "",
    });
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setReservaSel(null);
  };

  const handleChangeCampo = (campo, valor) => {
    setReservaSel((prev) => ({ ...prev, [campo]: valor }));
  };

  const guardarCambios = async () => {
    if (!reservaSel) return;
    setGuardando(true);
    try {
      await axios.put(
        `http://localhost:4000/api/reservas/${reservaSel.id}`,
        {
          fecha_inicio: reservaSel.fecha_inicio,
          fecha_fin: reservaSel.fecha_fin,
          estado: reservaSel.estado,
          notas: reservaSel.notas,
        }
      );
      await cargarReservas();
      setShowModal(false);
    } catch (e) {
      console.error("Error actualizando reserva:", e);
      alert("No se pudo actualizar la reserva.");
    } finally {
      setGuardando(false);
    }
  };

  const cancelarReserva = async (reserva) => {
    if (!window.confirm("¿Cancelar esta reserva?")) return;
    try {
      await axios.delete(
        `http://localhost:4000/api/reservas/${reserva.id}`
      );
      await cargarReservas();
    } catch (e) {
      console.error("Error al cancelar reserva:", e);
      alert("No se pudo cancelar la reserva.");
    }
  };

  // aplicar filtros en memoria (por ahora)
  const reservasFiltradas = reservas.filter((r) => {
    const texto = (
      `${r.huesped_nombre || ""} ${r.habitacion_numero || ""} ${r.id}` +
      ` ${r.estado || ""}`
    )
      .toLowerCase()
      .trim();

    const pasaTexto = texto.includes(filtroTexto.toLowerCase().trim());

    const pasaEstado =
      filtroEstado === "todas" ? true : r.estado === filtroEstado;

    return pasaTexto && pasaEstado;
  });

  return (
    <div>
      <h3 className="mb-3">Gestión de reservas</h3>

      {/* Filtros */}
      <Row className="mb-3">
        <Col md={6}>
          <Form.Control
            placeholder="Buscar por huésped, habitación, id o estado..."
            value={filtroTexto}
            onChange={(e) => setFiltroTexto(e.target.value)}
          />
        </Col>
        <Col md={3}>
          <Form.Select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
          >
            <option value="todas">Todos los estados</option>
            <option value="reservada">Reservadas</option>
            <option value="ocupada">Ocupadas</option>
            <option value="finalizada">Finalizadas</option>
            <option value="cancelada">Canceladas</option>
          </Form.Select>
        </Col>
        <Col md={3} className="text-md-end mt-2 mt-md-0">
          <Button variant="outline-secondary" size="sm" onClick={cargarReservas}>
            Recargar
          </Button>
        </Col>
      </Row>

      {/* Tabla */}
      {cargando ? (
        <div className="d-flex justify-content-center py-5">
          <Spinner animation="border" />
        </div>
      ) : (
        <div className="table-responsive">
          <Table striped hover size="sm">
            <thead>
              <tr>
                <th>#</th>
                <th>Huésped</th>
                <th>Habitación</th>
                <th>Ingreso</th>
                <th>Salida</th>
                <th>Estado</th>
                <th>Notas</th>
                <th style={{ width: 160 }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {reservasFiltradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-muted">
                    No hay reservas que coincidan con el filtro.
                  </td>
                </tr>
              )}

              {reservasFiltradas.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.huesped_nombre || "—"}</td>
                  <td>
                    Hab. {r.habitacion_numero} — {r.habitacion_tipo}
                  </td>
                  <td>{dayjs(r.fecha_inicio).format("YYYY-MM-DD")}</td>
                  <td>{dayjs(r.fecha_fin).format("YYYY-MM-DD")}</td>
                  <td>
                    <Badge bg={estadoColor(r.estado)}>{r.estado}</Badge>
                  </td>
                  <td style={{ maxWidth: 200 }}>
                    <small className="text-muted">
                      {r.notas ? r.notas.slice(0, 45) : "—"}
                      {r.notas && r.notas.length > 45 ? "..." : ""}
                    </small>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => abrirModal(r)}
                      >
                        Ver / editar
                      </Button>
                      <Button
                        variant="outline-danger"
                        size="sm"
                        disabled={r.estado !== "reservada"}
                        title={
                          r.estado !== "reservada"
                            ? "Solo se pueden cancelar reservas pendientes."
                            : ""
                        }
                        onClick={() => cancelarReserva(r)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Modal editar reserva */}
      <Modal show={showModal} onHide={cerrarModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reserva #{reservaSel?.id}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {reservaSel && (
            <>
              <p>
                <strong>Huésped:</strong> {reservaSel.huesped_nombre}
              </p>
              <p>
                <strong>Habitación:</strong> {reservaSel.habitacion_numero} —{" "}
                {reservaSel.habitacion_tipo}
              </p>

              <Row className="mb-2">
                <Col>
                  <Form.Label>Fecha de ingreso</Form.Label>
                  <Form.Control
                    type="date"
                    value={reservaSel.fecha_inicio}
                    onChange={(e) =>
                      handleChangeCampo("fecha_inicio", e.target.value)
                    }
                  />
                </Col>
                <Col>
                  <Form.Label>Fecha de salida</Form.Label>
                  <Form.Control
                    type="date"
                    value={reservaSel.fecha_fin}
                    onChange={(e) =>
                      handleChangeCampo("fecha_fin", e.target.value)
                    }
                  />
                </Col>
              </Row>

              <Form.Label>Estado</Form.Label>
              <Form.Select
                className="mb-2"
                value={reservaSel.estado}
                onChange={(e) =>
                  handleChangeCampo("estado", e.target.value)
                }
              >
                <option value="reservada">Reservada</option>
                <option value="ocupada">Ocupada</option>
                <option value="finalizada">Finalizada</option>
                <option value="cancelada">Cancelada</option>
              </Form.Select>

              <Form.Label>Notas internas</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={reservaSel.notas}
                onChange={(e) =>
                  handleChangeCampo("notas", e.target.value)
                }
                placeholder="Notas visibles solo para el personal del hotel..."
              />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarModal}>
            Cerrar
          </Button>
          <Button
            variant="primary"
            onClick={guardarCambios}
            disabled={guardando}
          >
            {guardando ? "Guardando..." : "Guardar cambios"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
