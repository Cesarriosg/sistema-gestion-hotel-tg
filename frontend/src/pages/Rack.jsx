import { useEffect, useState } from "react";
import axios from "axios";
import RackModal from "../components/RackModal";
import "./Rack.css";

export default function Rack() {
  const [habitaciones, setHabitaciones] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [habitacionSeleccionada, setHabitacionSeleccionada] = useState(null);

  const cargarHabitaciones = async () => {
    try {
      const res = await axios.get("http://localhost:4000/api/habitaciones");
      setHabitaciones(res.data);
    } catch (error) {
      console.log("Error cargando habitaciones:", error);
    }
  };

  useEffect(() => {
    cargarHabitaciones();
  }, []);

  const abrirModal = (hab) => {
    setHabitacionSeleccionada(hab);
    setModalOpen(true);
  };

  const cerrarModal = () => {
    setModalOpen(false);
  };

  return (
    <div>
      <h2 className="mb-3">🏨 Rack de Habitaciones</h2>

      <div className="rack-grid">
        {habitaciones.map((hab) => (
          <div
            key={hab.id}
            className={`rack-item ${hab.estado_real}`} // 👈 usamos el estado dinámico
            onClick={() => abrirModal(hab)}
          >
            <strong>Hab. {hab.numero}</strong>
            <p>{hab.tipo}</p>
            <span className="estado">{(hab.estado_real  || "desconocido").toUpperCase()}</span>
          </div>
        ))}
      </div>

      {modalOpen && (
        <RackModal
          isOpen={modalOpen}
          closeModal={cerrarModal}
          habitacion={habitacionSeleccionada}
          onReservaCreada={cargarHabitaciones} // 🔥 para refrescar después de reservar
        />
      )}
    </div>
  );
}
