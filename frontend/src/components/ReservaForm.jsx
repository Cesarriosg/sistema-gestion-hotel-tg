import { useState } from "react";
import axios from "axios";
import "./ReservaForm.css";

export default function ReservaForm({ habitacion, onClose, onReservaCreada }) {
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [error, setError] = useState("");

  // 🔍 Buscar huésped automáticamente cuando se escribe el documento
  const buscarHuesped = async (doc) => {
    try {
      const res = await axios.get(`http://localhost:4000/api/huespedes/buscar/${doc}`);
      if (res.data.encontrado) {
        setNombre(res.data.huesped.nombre);
        setTelefono(res.data.huesped.telefono);
      } else {
        setNombre("");
        setTelefono("");
      }
    } catch {
      setNombre("");
      setTelefono("");
    }
  };

  const crearReserva = async (e) => {
    e.preventDefault();
    setError("");

    try {
      let huesped_id;

      // 1️⃣ Verificar si el huésped ya existe
      try {
        const busqueda = await axios.get(`http://localhost:4000/api/huespedes/buscar/${documento}`);
        huesped_id = busqueda.data.huesped.id;
      } catch {
        // 2️⃣ Si no existe → registrarlo primero
        const nuevo = await axios.post("http://localhost:4000/api/huespedes", {
          nombre,
          documento,
          telefono,
        });
        huesped_id = nuevo.data.id;
      }

      // 3️⃣ Crear reserva
      await axios.post("http://localhost:4000/api/reservas", {
        habitacion_id: habitacion.id,
        huesped_id,
        fecha_inicio: inicio,
        fecha_fin: fin,
      });

      onReservaCreada(); // Actualizar rack
      onClose(); // Cerrar modal

    } catch (err) {
      console.error(err);
      setError("No se pudo crear la reserva. Verifique los datos.");
    }
  };

  return (
    <div className="reserva-form-container">
      <h3>Nueva Reserva — Hab {habitacion.numero}</h3>

      <form onSubmit={crearReserva}>
        <label>Documento del Huésped</label>
        <input
          type="text"
          required
          value={documento}
          onChange={(e) => {
            setDocumento(e.target.value);
            if (e.target.value.length >= 6) buscarHuesped(e.target.value);
          }}
        />

        <label>Nombre del Huésped</label>
        <input
          type="text"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />

        <label>Teléfono</label>
        <input
          type="text"
          required
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
        />

        <label>Fecha de Entrada</label>
        <input
          type="date"
          required
          value={inicio}
          onChange={(e) => setInicio(e.target.value)}
        />

        <label>Fecha de Salida</label>
        <input
          type="date"
          required
          value={fin}
          onChange={(e) => setFin(e.target.value)}
        />

        {error && <p className="error">{error}</p>}

        <button className="btn-primary w-100" type="submit">
          Crear Reserva
        </button>
      </form>
    </div>
  );
}
