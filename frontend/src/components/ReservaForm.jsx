import { useEffect, useState } from "react";
import axios from "axios";
import "./ReservaForm.css";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function ReservaForm({ onClose, onReservaCreada }) {
  // Datos huésped
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  // Reserva
  const [inicio, setInicio] = useState("");
  const [fin, setFin] = useState("");
  const [tipoHab, setTipoHab] = useState(""); // ej: sencilla, doble, suite...
  const [notas, setNotas] = useState("");

  // Disponibilidad
  const [buscando, setBuscando] = useState(false);
  const [disponibles, setDisponibles] = useState([]);
  const [habSeleccionada, setHabSeleccionada] = useState("");

  // Estados UI
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  // 🔍 Buscar huésped automáticamente cuando se escribe el documento
  const buscarHuesped = async (doc) => {
    try {
      const res = await axios.get(
        `http://localhost:4000/api/huespedes/buscar/${doc}`,
        { headers: getAuthHeaders() }
      );

      if (res.data.encontrado) {
        setNombre(res.data.huesped.nombre || "");
        setTelefono(res.data.huesped.telefono || "");
        setEmail(res.data.huesped.email || "");
      } else {
        // si no encuentra, no borro lo que el usuario ya pudo escribir
      }
    } catch {
      // silencioso
    }
  };

  const puedeBuscarDisponibles = () => {
    return inicio && fin && new Date(fin) > new Date(inicio);
  };

  const buscarDisponibles = async () => {
    setError("");
    setDisponibles([]);
    setHabSeleccionada("");

    if (!puedeBuscarDisponibles()) {
      setError("Selecciona un rango válido: la salida debe ser posterior al ingreso.");
      return;
    }

    try {
      setBuscando(true);
      const r = await axios.get("http://localhost:4000/api/reservas/disponibles", {
        params: {
          desde: inicio,
          hasta: fin,
          ...(tipoHab ? { tipo: tipoHab } : {}),
        },
        headers: getAuthHeaders(),
      });

      setDisponibles(r.data || []);
      if (!r.data || r.data.length === 0) {
        setError("No hay habitaciones disponibles para ese rango.");
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || "No se pudo consultar disponibilidad.");
    } finally {
      setBuscando(false);
    }
  };

  // Si cambian fechas/tipo, invalidamos selección
  useEffect(() => {
    setDisponibles([]);
    setHabSeleccionada("");
    setError("");
  }, [inicio, fin, tipoHab]);

  const crearReserva = async (e) => {
    e.preventDefault();
    setError("");

    if (!nombre.trim()) return setError("El nombre del huésped es obligatorio.");
    if (!puedeBuscarDisponibles()) return setError("Rango de fechas inválido.");
    if (!habSeleccionada) return setError("Selecciona una habitación disponible.");

    try {
      setGuardando(true);

      await axios.post(
        "http://localhost:4000/api/reservas",
        {
          tipo: "reserva",
          habitacion_numero: habSeleccionada,
          fecha_inicio: inicio,
          fecha_fin: fin,
          huesped_nombre: nombre.trim(),
          huesped_documento: documento.trim() || null,
          huesped_telefono: telefono.trim() || null,
          huesped_email: email.trim() || null,
          notas: notas.trim() || null,
        },
        { headers: getAuthHeaders() }
      );

      onReservaCreada?.(); // refrescar rack/listados
      onClose?.();         // cerrar modal
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;

      if (status === 409) {
        setError(msg || "Choque de fechas: esa habitación ya no está disponible.");
        return;
      }
      setError(msg || "No se pudo crear la reserva. Verifique los datos.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="reserva-form-container">
      <h3>Nueva Reserva (tipo Zeus)</h3>

      <form onSubmit={crearReserva}>
        <div className="grid2">
          <div>
            <label>Fecha de Entrada *</label>
            <input type="date" required value={inicio} onChange={(e) => setInicio(e.target.value)} />
          </div>

          <div>
            <label>Fecha de Salida *</label>
            <input type="date" required value={fin} onChange={(e) => setFin(e.target.value)} />
          </div>
        </div>

        <label>Tipo de habitación (opcional)</label>
        <select className="form-control" value={tipoHab} onChange={(e) => setTipoHab(e.target.value)}>
          <option value="">Todas</option>
          <option value="sencilla">sencilla</option>
          <option value="doble">doble</option>
          <option value="suite">suite</option>
        </select>

        <button
          type="button"
          className="btn btn-outline-primary w-100"
          style={{ marginTop: 10 }}
          onClick={buscarDisponibles}
          disabled={!puedeBuscarDisponibles() || buscando}
        >
          {buscando ? "Buscando disponibilidad..." : "🔍 Consultar habitaciones disponibles"}
        </button>

        <label style={{ marginTop: 10 }}>Habitación disponible *</label>
        <select
          className="form-control"
          value={habSeleccionada}
          onChange={(e) => setHabSeleccionada(e.target.value)}
          disabled={disponibles.length === 0}
          required
        >
          <option value="">Seleccione...</option>
          {disponibles.map((h) => (
            <option key={h.id} value={h.numero}>
              Hab. {h.numero} — {h.tipo}
            </option>
          ))}
        </select>

        <hr />

        <label>Documento del Huésped (opcional)</label>
        <input
          type="text"
          value={documento}
          onChange={(e) => {
            setDocumento(e.target.value);
            if (e.target.value.length >= 6) buscarHuesped(e.target.value);
          }}
        />

        <label>Nombre del Huésped *</label>
        <input type="text" required value={nombre} onChange={(e) => setNombre(e.target.value)} />

        <label>Teléfono (opcional)</label>
        <input type="text" value={telefono} onChange={(e) => setTelefono(e.target.value)} />

        <label>Email (opcional)</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />

        <label>Notas internas (opcional)</label>
        <textarea
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej: Llegará tarde, requiere cuna, etc."
        />

        {error && <p className="error">{error}</p>}

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary w-100" type="submit" disabled={guardando}>
            {guardando ? "Creando..." : "Crear Reserva"}
          </button>

          <button className="btn btn-outline-secondary" type="button" onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
