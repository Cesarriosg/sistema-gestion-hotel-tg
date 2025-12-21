// src/pages/Habitaciones.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { Form, Button, Badge } from "react-bootstrap";

export default function Habitaciones() {
  const [habitaciones, setHabitaciones] = useState([]);
  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const token = localStorage.getItem("token");

  const authHeader = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;

  const cargarHabitaciones = async () => {
    try {
      const { data } = await axios.get(
        "http://localhost:4000/api/habitaciones",
        { headers: authHeader }
      );
      setHabitaciones(data);
    } catch (e) {
      console.error("Error cargando habitaciones:", e);
      alert("No se pudieron cargar las habitaciones.");
    }
  };

  useEffect(() => {
    cargarHabitaciones();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await axios.put(
        `http://localhost:4000/api/habitaciones/${id}/estado`,
        { estado: nuevoEstado },
        { headers: authHeader }
      );
      await cargarHabitaciones();
    } catch (e) {
      console.error("Error cambiando estado:", e);
      alert("No se pudo cambiar el estado de la habitación.");
    }
  };

  const getBadge = (estado) => {
    if (estado === "disponible")
      return <Badge bg="success">Disponible</Badge>;
    if (estado === "ocupada")
      return <Badge bg="primary">Ocupada</Badge>;
    if (estado === "mantenimiento")
      return <Badge bg="warning" text="dark">Mantenimiento</Badge>;
    if (estado === "fuera_servicio")
      return <Badge bg="secondary">Fuera de servicio</Badge>;
    return <Badge bg="light" text="dark">{estado}</Badge>;
  };

  const listaFiltrada = habitaciones.filter((h) => {
    const texto = `${h.numero} ${h.tipo}`.toLowerCase();
    const pasaTexto = texto.includes(filtroTexto.toLowerCase());
    const pasaEstado =
      filtroEstado === "todos" ? true : h.estado === filtroEstado;
    return pasaTexto && pasaEstado;
  });

  return (
    <div style={{ padding: 10 }}>
      <h2>Control de Habitaciones</h2>

      <div className="d-flex gap-2 my-3 flex-wrap">
        <Form.Control
          style={{ maxWidth: 260 }}
          placeholder="Buscar por número o tipo..."
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
        />

        <Form.Select
          style={{ maxWidth: 220 }}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos</option>
          <option value="disponible">Disponibles</option>
          <option value="ocupada">Ocupadas</option>
          <option value="mantenimiento">En mantenimiento</option>
          <option value="fuera_servicio">Fuera de servicio</option>
        </Form.Select>

        <Button variant="outline-secondary" onClick={cargarHabitaciones}>
          Recargar
        </Button>
      </div>

      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Número</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Acciones rápidas</th>
            </tr>
          </thead>
          <tbody>
            {listaFiltrada.map((h, idx) => (
              <tr key={h.id}>
                <td>{idx + 1}</td>
                <td>{h.numero}</td>
                <td>{h.tipo}</td>
                <td>{getBadge(h.estado)}</td>
                <td className="d-flex gap-2">
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => cambiarEstado(h.id, "disponible")}
                  >
                    Disponible
                  </Button>
                  <Button
                    size="sm"
                    variant="warning"
                    onClick={() => cambiarEstado(h.id, "mantenimiento")}
                  >
                    Mantenimiento
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => cambiarEstado(h.id, "fuera_servicio")}
                  >
                    Fuera de servicio
                  </Button>
                </td>
              </tr>
            ))}
            {!listaFiltrada.length && (
              <tr>
                <td colSpan={5} className="text-center text-muted">
                  No hay habitaciones que coincidan con el filtro.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
