// src/pages/Huespedes.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { Form, Button, Modal } from "react-bootstrap";
import dayjs from "dayjs";

export default function Huespedes() {
  const [huespedes, setHuespedes] = useState([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cargando, setCargando] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState(null);

  const token = localStorage.getItem("token");
  const authHeader = token ? { Authorization: `Bearer ${token}` } : undefined;

  const cargarHuespedes = async () => {
    try {
      setCargando(true);
      const params = {};
      if (filtroTexto) params.q = filtroTexto;
      if (desde && hasta) {
        params.desde = desde;
        params.hasta = hasta;
      }

      const { data } = await axios.get("http://localhost:4000/api/huespedes", {
        params,
        headers: authHeader,
      });
      setHuespedes(data);
    } catch (e) {
      console.error("Error cargando huéspedes:", e);
      alert("No se pudieron cargar los huéspedes.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarHuespedes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const abrirModalEdicion = (h) => {
    setEditando({
      ...h,
      fecha_nacimiento: h.fecha_nacimiento
        ? dayjs(h.fecha_nacimiento).format("YYYY-MM-DD")
        : "",
    });
    setShowModal(true);
  };

  const cerrarModal = () => {
    setShowModal(false);
    setEditando(null);
  };

  const onChangeEdit = (campo, valor) => {
    setEditando((prev) => ({ ...prev, [campo]: valor }));
  };

  const guardarHuesped = async () => {
    if (!editando) return;
    if (!editando.nombre || editando.nombre.trim() === "") {
      alert("El nombre es obligatorio.");
      return;
    }

    try {
      await axios.put(
        `http://localhost:4000/api/huespedes/${editando.id}`,
        {
          nombre: editando.nombre,
          documento: editando.documento,
          telefono: editando.telefono,
          email: editando.email,
          fecha_nacimiento: editando.fecha_nacimiento || null,
        },
        { headers: authHeader }
      );
      await cargarHuespedes();
      cerrarModal();
    } catch (e) {
      console.error("Error actualizando huésped:", e);
      alert("No se pudo actualizar el huésped.");
    }
  };

  const limpiarFiltros = () => {
    setFiltroTexto("");
    setDesde("");
    setHasta("");
  };

  return (
    <div style={{ padding: 10 }}>
      <h2>Gestión de Huéspedes</h2>

      <div className="d-flex flex-wrap gap-2 my-3">
        <Form.Control
          style={{ maxWidth: 260 }}
          placeholder="Buscar por nombre o documento..."
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
        />

        <div className="d-flex align-items-center gap-1">
          <Form.Label className="mb-0">Desde:</Form.Label>
          <Form.Control
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>

        <div className="d-flex align-items-center gap-1">
          <Form.Label className="mb-0">Hasta:</Form.Label>
          <Form.Control
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <Button variant="primary" onClick={cargarHuespedes}>
          Buscar
        </Button>

        <Button variant="outline-secondary" onClick={limpiarFiltros}>
          Limpiar
        </Button>
      </div>

      {cargando && <p>Cargando huéspedes...</p>}

      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Nombre</th>
              <th>Documento</th>
              <th>Teléfono</th>
              <th>Email</th>
              <th>Última estadía</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {!cargando &&
              huespedes.map((h, idx) => (
                <tr key={h.id}>
                  <td>{idx + 1}</td>
                  <td>{h.nombre}</td>
                  <td>{h.documento || "—"}</td>
                  <td>{h.telefono || "—"}</td>
                  <td>{h.email || "—"}</td>
                  <td>
                    {h.ultima_estadia
                      ? dayjs(h.ultima_estadia).format("YYYY-MM-DD")
                      : "—"}
                  </td>
                  <td>
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => abrirModalEdicion(h)}
                    >
                      Ver / editar
                    </Button>
                  </td>
                </tr>
              ))}

            {!cargando && !huespedes.length && (
              <tr>
                <td colSpan={7} className="text-center text-muted">
                  No se encontraron huéspedes con esos filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal edición */}
      <Modal show={showModal} onHide={cerrarModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar huésped</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editando && (
            <Form>
              <Form.Group className="mb-2">
                <Form.Label>Nombre *</Form.Label>
                <Form.Control
                  value={editando.nombre}
                  onChange={(e) => onChangeEdit("nombre", e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Documento</Form.Label>
                <Form.Control
                  value={editando.documento || ""}
                  onChange={(e) => onChangeEdit("documento", e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Teléfono</Form.Label>
                <Form.Control
                  value={editando.telefono || ""}
                  onChange={(e) => onChangeEdit("telefono", e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  value={editando.email || ""}
                  onChange={(e) => onChangeEdit("email", e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Fecha de nacimiento</Form.Label>
                <Form.Control
                  type="date"
                  value={editando.fecha_nacimiento || ""}
                  onChange={(e) =>
                    onChangeEdit("fecha_nacimiento", e.target.value)
                  }
                />
              </Form.Group>
            </Form>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={cerrarModal}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardarHuesped}>
            Guardar cambios
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
