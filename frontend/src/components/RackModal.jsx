import Modal from "react-modal";
import { motion } from "framer-motion";
import { useState } from "react";
import ReservaForm from "./ReservaForm";
import "./RackModal.css";

Modal.setAppElement("#root");

export default function RackModal({ isOpen, closeModal, habitacion }) {
  const [mostrarReservaForm, setMostrarReservaForm] = useState(false);

  if (!habitacion) return null;

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={closeModal}
      className="modal-content"
      overlayClassName="modal-overlay"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
      >
        {/* Título */}
        <h2 className="modal-title">
          Habitación {habitacion.numero} — {habitacion.tipo}
        </h2>

        {/* Estado */}
        {!mostrarReservaForm && (
          <p className={`estado estado-${habitacion.estado}`}>
            Estado: {(habitacion.estado_real || "desconocido").toUpperCase()}
          </p>
        )}

        {/* Si el usuario elige crear reserva, mostramos el formulario */}
        {mostrarReservaForm ? (
          <ReservaForm
            habitacion={habitacion}
            onClose={closeModal}
            onReservaCreada={() => {
              closeModal();
              window.location.reload(); // refrescar rack automáticamente
            }}
          />
        ) : (
          <>
            {/* Acciones según estado */}
            <div className="modal-actions">

              {habitacion.estado === "disponible" && (
                <button
                  className="btn-primary"
                  onClick={() => setMostrarReservaForm(true)}
                >
                  Crear Reserva
                </button>
              )}

              {habitacion.estado === "reservada" && (
                <>
                  <button className="btn-primary">Realizar Check-In</button>
                  <button className="btn-secondary">Ver Reserva</button>
                  <button className="btn-warning">Cancelar Reserva</button>
                </>
              )}

              {habitacion.estado === "ocupada" && (
                <>
                  <button className="btn-primary">Realizar Check-Out</button>
                  <button className="btn-secondary">Agregar Servicios</button>
                  <button className="btn-secondary">Ver Detalles del Huésped</button>
                </>
              )}

              {habitacion.estado === "mantenimiento" && (
                <button className="btn-warning">Marcar Disponible</button>
              )}

            </div>

            {/* Botón de cerrar */}
            <button className="btn-close" onClick={closeModal}>
              Cerrar
            </button>
          </>
        )}
      </motion.div>
    </Modal>
  );
}
