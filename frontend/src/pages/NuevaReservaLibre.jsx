// src/pages/NuevaReservaLibre.jsx
import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function NuevaReservaLibre() {
  const nav = useNavigate();

  // selección principal
  const [tipo, setTipo] = useState("");
  const [tipos, setTipos] = useState([]);
  const [plan, setPlan] = useState("");
  const [planes, setPlanes] = useState([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  // disponibles
  const [habitacionesDisp, setHabitacionesDisp] = useState([]);
  const [habNumero, setHabNumero] = useState("");

  // precio
  const [precioNoche, setPrecioNoche] = useState(null);
  const [noches, setNoches] = useState(null);
  const [total, setTotal] = useState(null);

  // huésped
  const [nombre, setNombre] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [notas, setNotas] = useState("");

  // ui
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [cargandoPrecio, setCargandoPrecio] = useState(false);
  const [cargandoDisponibles, setCargandoDisponibles] = useState(false);

  // Cargar tipos de habitación y planes desde la API
  useEffect(() => {
    axios.get("http://localhost:4000/api/tipos-habitacion", { headers: getAuthHeaders() })
      .then(({ data }) => {
        const activos = (data || []).filter(t => t.activo);
        setTipos(activos);
        if (activos.length > 0) setTipo(activos[0].nombre);
      })
      .catch(() => {});
    axios.get("http://localhost:4000/api/planes", { headers: getAuthHeaders() })
      .then(({ data }) => {
        const activos = (data || []).filter(p => p.activo);
        setPlanes(activos);
        if (activos.length > 0) setPlan(activos[0].codigo);
      })
      .catch(() => {});
  }, []);

  const limpiarPrecio = () => {
    setPrecioNoche(null);
    setNoches(null);
    setTotal(null);
  };

  const cargarPrecio = async () => {
    setError("");
    limpiarPrecio();

    if (!tipo || !plan || !desde || !hasta) return;

    try {
      setCargandoPrecio(true);
      const { data } = await axios.get(
        "http://localhost:4000/api/reservas/precio",
        { params: { tipo, plan, desde, hasta }, headers: getAuthHeaders() }
      );

      setPrecioNoche(data.precio_noche);
      setNoches(data.noches);
      setTotal(data.total);
    } catch (e) {
      const msg = e?.response?.data?.message || "No se pudo calcular el precio.";
      setError(msg);
    } finally {
      setCargandoPrecio(false);
    }
  };

  const cargarDisponibles = async () => {
    setError("");
    setHabitacionesDisp([]);
    setHabNumero("");

    if (!tipo || !desde || !hasta) return;

    try {
      setCargandoDisponibles(true);
      const { data } = await axios.get(
        "http://localhost:4000/api/reservas/disponibles",
        { params: { tipo, desde, hasta }, headers: getAuthHeaders() }
      );

      setHabitacionesDisp(data || []);

      // Auto-seleccionar la primera disponible
      if (data?.length) {
        setHabNumero(String(data[0].numero));
      }
    } catch (e) {
      const msg =
        e?.response?.data?.message ||
        "No se pudieron cargar habitaciones disponibles.";
      setError(msg);
    } finally {
      setCargandoDisponibles(false);
    }
  };

  useEffect(() => {
    cargarPrecio();
    cargarDisponibles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, plan, desde, hasta]);

  const crearReserva = async () => {
    setError("");

    if (!nombre.trim()) return setError("El nombre del huésped es obligatorio.");
    if (!desde || !hasta) return setError("Debe seleccionar el rango de fechas.");
    if (!plan) return setError("Debe seleccionar un plan.");
    if (!habNumero) return setError("Debe seleccionar una habitación disponible.");
    if (precioNoche == null || total == null) {
      return setError("Primero calcula el precio antes de crear la reserva.");
    }

    try {
      setGuardando(true);

      await axios.post(
        "http://localhost:4000/api/reservas",
        {
          tipo: "reserva",
          habitacion_numero: habNumero,
          fecha_inicio: desde,
          fecha_fin: hasta,

          huesped_nombre: nombre.trim(),
          huesped_documento: documento.trim() || null,
          huesped_telefono: telefono.trim() || null,
          huesped_email: email.trim() || null,
          notas: notas.trim() || null,

          // ✅ nuevo
          plan,
          tarifa_snapshot: precioNoche, // congela precio/noche al crear (recomendado)
        },
        { headers: getAuthHeaders() }
      );

      nav("/calendario");
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;

      if (status === 409) return setError(msg || "Choque de fechas.");
      setError(msg || "No se pudo crear la reserva.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="container-sm" style={{ maxWidth: 780, padding: 20 }}>
      <h2>Nueva reserva (manual)</h2>

      <div className="row">
        <div className="col-md-4">
          <label>Tipo de habitación</label>
          <select
            className="form-select"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {tipos.length === 0
              ? <option value="">Cargando tipos...</option>
              : tipos.map(t => <option key={t.id} value={t.nombre}>{t.nombre}</option>)
            }
          </select>
        </div>

        <div className="col-md-4">
          <label>Plan / Tarifa</label>
          <select
            className="form-select"
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
          >
            {planes.length === 0
              ? <option value="">Sin planes — ve a Administración → Planes</option>
              : planes.map(p => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo}{p.descripcion ? ` — ${p.descripcion}` : ""}
                  </option>
                ))
            }
          </select>
        </div>

        <div className="col-md-4">
          <label>Habitación disponible *</label>
          <select
            className="form-select"
            value={habNumero}
            onChange={(e) => setHabNumero(e.target.value)}
            disabled={cargandoDisponibles || !habitacionesDisp.length}
          >
            {cargandoDisponibles && <option value="">Cargando...</option>}

            {!cargandoDisponibles && !habitacionesDisp.length && (
              <option value="">(No hay disponibles)</option>
            )}

            {!cargandoDisponibles &&
              habitacionesDisp.map((h) => (
                <option key={h.id} value={h.numero}>
                  Hab. {h.numero} — {h.tipo}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <div className="col-md-6">
          <label>Desde</label>
          <input
            className="form-control"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label>Hasta</label>
          <input
            className="form-control"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
      </div>

      <hr />

      <h5>Precio</h5>
      {cargandoPrecio ? (
        <p className="text-muted">Calculando...</p>
      ) : precioNoche != null ? (
        <div>
          <p>
            <b>Precio/noche:</b> ${precioNoche}
          </p>
          <p>
            <b>Noches:</b> {noches}
          </p>
          <p>
            <b>Total:</b> ${total}
          </p>
        </div>
      ) : (
        <p className="text-muted">Selecciona tipo, plan y fechas para calcular.</p>
      )}

      <hr />

      <h5>Datos del huésped</h5>
      <label>Nombre *</label>
      <input
        className="form-control"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />

      <div className="row" style={{ marginTop: 10 }}>
        <div className="col-md-6">
          <label>Documento</label>
          <input
            className="form-control"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </div>
        <div className="col-md-6">
          <label>Teléfono</label>
          <input
            className="form-control"
            value={telefono}
            onChange={(e) => setTelefono(e.target.value)}
          />
        </div>
      </div>

      <label style={{ marginTop: 10 }}>Email</label>
      <input
        className="form-control"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <label style={{ marginTop: 10 }}>Notas internas</label>
      <textarea
        className="form-control"
        rows={3}
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
      />

      {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
        <button
          className="btn btn-primary"
          onClick={crearReserva}
          disabled={guardando || !nombre.trim()}
        >
          {guardando ? "Creando..." : "Crear reserva"}
        </button>

        <button
          className="btn btn-outline-secondary"
          onClick={() => nav(-1)}
          disabled={guardando}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}