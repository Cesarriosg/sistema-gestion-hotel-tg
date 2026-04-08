// src/pages/NuevoWalkIn.jsx
// Walk-In directo: selecciona habitación y fechas en el mismo formulario
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const TIPOS_DOC = [
  { value: "",    label: "Seleccione..." },
  { value: "CC",  label: "Cedula (CC)" },
  { value: "CE",  label: "Cedula extranjeria (CE)" },
  { value: "PA",  label: "Pasaporte (PA)" },
  { value: "NIT", label: "NIT" },
];

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("es-CO");
};

const planLabel = (p) => {
  const x = (p || "").toUpperCase();
  if (x === "GK") return "Gold King (GK)";
  if (x === "C1") return "Clasico 1 (C1)";
  return p || "—";
};

export default function NuevoWalkIn() {
  const nav = useNavigate();
  const q   = new URLSearchParams(useLocation().search);

  // Parámetros opcionales desde URL (cuando viene del Rack)
  const paramHab   = q.get("hab")   || "";
  const paramDesde = q.get("desde") || "";
  const paramHasta = q.get("hasta") || "";

  // ── Habitación y fechas (editables si vienen vacíos) ──────────────────────
  const [habNumero,     setHabNumero]     = useState(paramHab);
  const [desde,         setDesde]         = useState(paramDesde || dayjs().format("YYYY-MM-DD"));
  const [hasta,         setHasta]         = useState(paramHasta || dayjs().add(1, "day").format("YYYY-MM-DD"));
  const [habitaciones,  setHabitaciones]  = useState([]);
  const [cargandoHabs,  setCargandoHabs]  = useState(false);

  // ── Plan y tarifa ──────────────────────────────────────────────────────────
  const [plan,           setPlan]           = useState("C1");
  const [planes,         setPlanes]         = useState(["C1", "GK"]);
  const [tipoHabitacion, setTipoHabitacion] = useState("");
  const [tipoErr,        setTipoErr]        = useState("");
  const [cargandoTarifa, setCargandoTarifa] = useState(false);
  const [tarifaErr,      setTarifaErr]      = useState("");
  const [tarifa,         setTarifa]         = useState(null);

  // ── Titular ────────────────────────────────────────────────────────────────
  const [tipoDocumento,   setTipoDocumento]   = useState("");
  const [documento,       setDocumento]       = useState("");
  const [nombres,         setNombres]         = useState("");
  const [primerApellido,  setPrimerApellido]  = useState("");
  const [segundoApellido, setSegundoApellido] = useState("");
  const [telefono,        setTelefono]        = useState("");
  const [email,           setEmail]           = useState("");
  const [direccion,       setDireccion]       = useState("");
  const [ciudad,          setCiudad]          = useState("");
  const [nacionalidad,    setNacionalidad]    = useState("");
  const [notas,           setNotas]           = useState("");

  // ── Acompañantes ───────────────────────────────────────────────────────────
  const [acompanantes, setAcompanantes] = useState([]);

  const addAcompanante = () =>
    setAcompanantes((p) => [...p, { tipo_documento: "CC", documento: "", nombres: "", primer_apellido: "", segundo_apellido: "" }]);
  const removeAcompanante = (i) =>
    setAcompanantes((p) => p.filter((_, idx) => idx !== i));
  const setAcompananteField = (i, key, val) =>
    setAcompanantes((p) => { const c = [...p]; c[i] = { ...c[i], [key]: val }; return c; });

  // ── Autofill ───────────────────────────────────────────────────────────────
  const [autocompletando,  setAutocompletando]  = useState(false);
  const [autofillMsg,      setAutofillMsg]      = useState("");
  const [huespedEncontrado,setHuespedEncontrado]= useState(null);

  const touchedRef = useRef({
    nombres: false, primerApellido: false, segundoApellido: false,
    telefono: false, email: false, direccion: false, ciudad: false, nacionalidad: false,
  });

  // ── Guardado ───────────────────────────────────────────────────────────────
  const [guardando, setGuardando] = useState(false);
  const [error,     setError]     = useState("");

  const nombreCompleto = useMemo(
    () => [nombres, primerApellido, segundoApellido].map((s) => (s || "").trim()).filter(Boolean).join(" "),
    [nombres, primerApellido, segundoApellido]
  );

  // ── Cargar habitaciones disponibles ───────────────────────────────────────
  const cargarHabitaciones = useCallback(async () => {
    if (!desde || !hasta) return;
    setCargandoHabs(true);
    try {
      const { data } = await axios.get(`${API}/api/habitaciones`, {
        headers: getAuthHeaders(),
      });
      // Filtramos solo disponibles usando estado_operativo (calculado por el backend)
      const disp = (data || []).filter(
        (h) => h.activo && (h.estado_operativo || h.estado_base) === "disponible"
      );
      setHabitaciones(disp);
    } catch (e) {
      console.error("Error cargando habitaciones:", e);
    } finally {
      setCargandoHabs(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargarHabitaciones();
  }, [cargarHabitaciones]);

  // Cargar planes dinámicos
  useEffect(() => {
    axios.get(`${API}/api/planes`, { headers: getAuthHeaders() })
      .then(({ data }) => {
        const activos = (data || []).filter(p => p.activo);
        if (activos.length) {
          setPlanes(activos);
          setPlan(activos[0].codigo);
        }
      })
      .catch(() => {});
  }, []);

  // ── Cargar tipo de habitación cuando cambia habNumero ─────────────────────
  useEffect(() => {
    setTipoErr("");
    setTipoHabitacion("");
    if (!habNumero) return;

    const found = habitaciones.find((h) => String(h.numero) === String(habNumero));
    if (found) {
      setTipoHabitacion((found.tipo || "").toString().trim());
      return;
    }

    // Si viene de URL y aún no cargaron las habitaciones, consulta directamente
    axios
      .get(`${API}/api/habitaciones/por-numero/${habNumero}`, { headers: getAuthHeaders() })
      .then((r) => setTipoHabitacion((r.data?.tipo || "").toString().trim()))
      .catch((e) => setTipoErr(e?.response?.data?.message || "No se pudo cargar el tipo de habitacion."));
  }, [habNumero, habitaciones]);

  // ── Cargar tarifa ─────────────────────────────────────────────────────────
  useEffect(() => {
    setTarifaErr("");
    setTarifa(null);
    if (!tipoHabitacion || !desde || !hasta) return;

    let cancelled = false;
    setCargandoTarifa(true);

    axios
      .get(`${API}/api/reservas/previsualizarPrecioReserva`, {
        params: { tipo: tipoHabitacion, plan, desde, hasta },
        headers: getAuthHeaders(),
      })
      .then((r) => { if (!cancelled) setTarifa(r.data); })
      .catch((e) => { if (!cancelled) setTarifaErr(e?.response?.data?.message || "No hay tarifa para este plan/tipo/rango."); })
      .finally(() => { if (!cancelled) setCargandoTarifa(false); });

    return () => { cancelled = true; };
  }, [tipoHabitacion, plan, desde, hasta]);

  // ── Autofill por documento ─────────────────────────────────────────────────
  useEffect(() => {
    setAutofillMsg("");
    setHuespedEncontrado(null);
    const td  = (tipoDocumento || "").trim().toUpperCase();
    const doc = (documento     || "").trim();
    if (!td || doc.length < 5) return;

    const t = setTimeout(async () => {
      try {
        setAutocompletando(true);
        const { data: h } = await axios.get(`${API}/api/huespedes/buscar`, {
          params: { tipo_documento: td, documento: doc },
          headers: getAuthHeaders(),
        });
        setHuespedEncontrado(h);
        setAutofillMsg("Huesped encontrado. Datos autocompletados.");
        if (!touchedRef.current.nombres        && !nombres.trim())         setNombres(h.nombres || "");
        if (!touchedRef.current.primerApellido && !primerApellido.trim())  setPrimerApellido(h.primer_apellido || "");
        if (!touchedRef.current.segundoApellido&& !segundoApellido.trim()) setSegundoApellido(h.segundo_apellido || "");
        if (!touchedRef.current.telefono       && !telefono.trim())        setTelefono(h.telefono || "");
        if (!touchedRef.current.email          && !email.trim())           setEmail(h.email || "");
        if (!touchedRef.current.direccion      && !direccion.trim())       setDireccion(h.direccion || "");
        if (!touchedRef.current.ciudad         && !ciudad.trim())          setCiudad(h.ciudad || "");
        if (!touchedRef.current.nacionalidad   && !nacionalidad.trim())    setNacionalidad(h.nacionalidad || "");
      } catch (e) {
        if (e?.response?.status === 404) {
          setAutofillMsg("No existe huesped con ese documento. Puedes registrarlo.");
          setHuespedEncontrado(null);
          return;
        }
        setAutofillMsg(e?.response?.data?.message || "No se pudo autocompletar.");
      } finally {
        setAutocompletando(false);
      }
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDocumento, documento]);

  // ── Registrar ─────────────────────────────────────────────────────────────
  const registrar = async () => {
    setError("");

    if (!habNumero) { setError("Selecciona una habitacion."); return; }
    if (!desde || !hasta) { setError("El rango de fechas es obligatorio."); return; }
    if (dayjs(hasta).isBefore(dayjs(desde)) || dayjs(hasta).isSame(dayjs(desde))) {
      setError("La fecha de salida debe ser posterior a la de entrada."); return;
    }
    if (!nombres.trim() || !primerApellido.trim()) {
      setError("Nombres y primer apellido son obligatorios."); return;
    }
    if (!tipoDocumento || !documento.trim()) {
      setError("Tipo de documento y numero de documento son obligatorios para Walk-In."); return;
    }
    if (!tarifa || !Number(tarifa.total) || tarifaErr) {
      setError("No hay tarifa calculada. Verifica plan / tipo / fechas."); return;
    }
    for (const a of acompanantes) {
      if ((a.tipo_documento && !a.documento) || (!a.tipo_documento && a.documento)) {
        setError("En acompanantes: completa tipo y documento (o deja ambos vacios)."); return;
      }
    }

    const tarifa_snapshot = {
      plan,
      plan_label: planLabel(plan),
      tipo_habitacion: tipoHabitacion,
      desde,
      hasta,
      noches:      Number(tarifa.noches      || 1),
      precio_noche: Number(tarifa.precio_noche || 0),
      total:        Number(tarifa.total        || 0),
      moneda: "COP",
      generado_en: new Date().toISOString(),
    };

    try {
      setGuardando(true);
      await axios.post(
        `${API}/api/reservas`,
        {
          tipo:              "walkin",
          habitacion_numero: habNumero,
          fecha_inicio:      desde,
          fecha_fin:         hasta,
          tipo_documento:    tipoDocumento,
          huesped_documento: documento.trim(),
          huesped_telefono:  telefono.trim()  || null,
          huesped_email:     email.trim()     || null,
          nombres:           nombres.trim(),
          primer_apellido:   primerApellido.trim(),
          segundo_apellido:  segundoApellido.trim() || null,
          direccion:         direccion.trim() || null,
          ciudad:            ciudad.trim()    || null,
          nacionalidad:      nacionalidad.trim() || null,
          huesped_nombre:    nombreCompleto,
          notas:             notas.trim() || null,
          plan,
          tarifa_snapshot,
          acompanantes,
        },
        { headers: getAuthHeaders() }
      );
      nav("/rack");
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo registrar el Walk-In.");
    } finally {
      setGuardando(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const noches = desde && hasta ? Math.max(0, dayjs(hasta).diff(dayjs(desde), "day")) : 0;

  return (
    <div className="container" style={{ maxWidth: 980, paddingTop: 18, paddingBottom: 24 }}>
      <div className="card shadow-sm">
        <div className="card-body" style={{ padding: 22 }}>

          <h3 className="mb-0">Registrar Walk-In</h3>
          <div className="text-muted mb-3">
            Entrada inmediata del huesped con plan y tarifa automaticos.
          </div>

          {/* ── Habitacion y fechas ── */}
          <div className="card border-0 mb-3" style={{ background: "#f0f4ff" }}>
            <div className="card-body py-3">
              <div className="fw-semibold mb-2">Habitacion y fechas de estadia</div>
              <div className="row g-2 align-items-end">

                <div className="col-md-4">
                  <label className="form-label">Habitacion *</label>
                  {cargandoHabs ? (
                    <div className="form-control text-muted">Cargando...</div>
                  ) : (
                    <select
                      className="form-select"
                      value={habNumero}
                      onChange={(e) => setHabNumero(e.target.value)}
                    >
                      <option value="">Seleccione...</option>
                      {/* Si vino de URL y no está en disponibles, lo agrega igual */}
                      {paramHab && !habitaciones.find((h) => String(h.numero) === paramHab) && (
                        <option value={paramHab}>Hab. {paramHab} (pre-seleccionada)</option>
                      )}
                      {habitaciones.map((h) => (
                        <option key={h.id} value={h.numero}>
                          Hab. {h.numero} — {h.tipo}
                        </option>
                      ))}
                    </select>
                  )}
                  {tipoHabitacion && (
                    <div className="form-text">Tipo: <b>{tipoHabitacion}</b></div>
                  )}
                  {tipoErr && <div className="text-danger" style={{ fontSize: 12 }}>{tipoErr}</div>}
                </div>

                <div className="col-md-3">
                  <label className="form-label">Entrada *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={desde}
                    onChange={(e) => setDesde(e.target.value)}
                  />
                </div>

                <div className="col-md-3">
                  <label className="form-label">Salida *</label>
                  <input
                    type="date"
                    className="form-control"
                    value={hasta}
                    min={desde || undefined}
                    onChange={(e) => setHasta(e.target.value)}
                  />
                </div>

                <div className="col-md-2">
                  <div className="p-2 text-center rounded" style={{ background: "#fff", border: "1px solid #c7d2fe" }}>
                    <div className="text-muted" style={{ fontSize: 11 }}>NOCHES</div>
                    <div className="fw-bold" style={{ fontSize: 22 }}>{noches}</div>
                  </div>
                </div>

              </div>
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {autofillMsg && (
            <div className={`alert py-2 ${huespedEncontrado ? "alert-success" : "alert-secondary"}`}>
              {autofillMsg}
              {autocompletando && <span className="ms-2 text-muted">Buscando...</span>}
            </div>
          )}

          <div className="row g-3">

            {/* ── Izquierda: datos titular + acompañantes ── */}
            <div className="col-md-7">
              <div className="card border-0" style={{ background: "#f8fafc" }}>
                <div className="card-body">
                  <div className="fw-semibold mb-2">Titular</div>

                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label">Tipo doc. *</label>
                      <select className="form-select" value={tipoDocumento}
                        onChange={(e) => setTipoDocumento(e.target.value)}>
                        {TIPOS_DOC.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}
                      </select>
                    </div>

                    <div className="col-md-8">
                      <label className="form-label">Documento *</label>
                      <input className="form-control" value={documento}
                        onChange={(e) => setDocumento(e.target.value)} placeholder="Ej: 123456789" />
                      <div className="form-text">Al escribir, se autocompleta si ya existe en el sistema.</div>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Nombres *</label>
                      <input className="form-control" value={nombres}
                        onChange={(e) => { touchedRef.current.nombres = true; setNombres(e.target.value); }} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Primer apellido *</label>
                      <input className="form-control" value={primerApellido}
                        onChange={(e) => { touchedRef.current.primerApellido = true; setPrimerApellido(e.target.value); }} />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Segundo apellido</label>
                      <input className="form-control" value={segundoApellido}
                        onChange={(e) => { touchedRef.current.segundoApellido = true; setSegundoApellido(e.target.value); }} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Telefono</label>
                      <input className="form-control" value={telefono} placeholder="Ej: 3001234567"
                        onChange={(e) => { touchedRef.current.telefono = true; setTelefono(e.target.value); }} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input className="form-control" value={email} placeholder="correo@..."
                        onChange={(e) => { touchedRef.current.email = true; setEmail(e.target.value); }} />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Direccion</label>
                      <input className="form-control" value={direccion}
                        onChange={(e) => { touchedRef.current.direccion = true; setDireccion(e.target.value); }} />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">Ciudad</label>
                      <input className="form-control" value={ciudad}
                        onChange={(e) => { touchedRef.current.ciudad = true; setCiudad(e.target.value); }} />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">Nacionalidad</label>
                      <input className="form-control" value={nacionalidad}
                        onChange={(e) => { touchedRef.current.nacionalidad = true; setNacionalidad(e.target.value); }} />
                    </div>

                    <div className="col-12">
                      <div className="text-muted">Nombre completo (auto): <b>{nombreCompleto || "—"}</b></div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Notas internas</label>
                      <textarea className="form-control" rows={2} value={notas}
                        onChange={(e) => setNotas(e.target.value)} />
                    </div>
                  </div>

                  {/* Acompañantes */}
                  <hr className="my-3" />
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="fw-semibold">Acompanantes</div>
                    <button type="button" className="btn btn-outline-primary btn-sm"
                      onClick={addAcompanante} disabled={guardando}>
                      + Agregar
                    </button>
                  </div>

                  {acompanantes.length === 0 ? (
                    <div className="text-muted mt-2">Sin acompanantes.</div>
                  ) : (
                    <div className="mt-2">
                      {acompanantes.map((a, idx) => (
                        <div key={idx} className="border rounded p-2 mb-2" style={{ background: "#fff" }}>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div className="fw-semibold">Acompanante #{idx + 1}</div>
                            <button type="button" className="btn btn-outline-danger btn-sm"
                              onClick={() => removeAcompanante(idx)} disabled={guardando}>Quitar</button>
                          </div>
                          <div className="row g-2">
                            <div className="col-md-4">
                              <label className="form-label">Tipo doc.</label>
                              <select className="form-select" value={a.tipo_documento}
                                onChange={(e) => setAcompananteField(idx, "tipo_documento", e.target.value)}>
                                {TIPOS_DOC.filter((x) => x.value).map((x) =>
                                  <option key={x.value} value={x.value}>{x.label}</option>)}
                              </select>
                            </div>
                            <div className="col-md-8">
                              <label className="form-label">Documento</label>
                              <input className="form-control" value={a.documento}
                                onChange={(e) => setAcompananteField(idx, "documento", e.target.value)} />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Nombres</label>
                              <input className="form-control" value={a.nombres}
                                onChange={(e) => setAcompananteField(idx, "nombres", e.target.value)} />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Primer apellido</label>
                              <input className="form-control" value={a.primer_apellido}
                                onChange={(e) => setAcompananteField(idx, "primer_apellido", e.target.value)} />
                            </div>
                            <div className="col-md-4">
                              <label className="form-label">Segundo apellido</label>
                              <input className="form-control" value={a.segundo_apellido}
                                onChange={(e) => setAcompananteField(idx, "segundo_apellido", e.target.value)} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Derecha: Plan y tarifa ── */}
            <div className="col-md-5">
              <div className="card border-0" style={{ background: "#f8fafc" }}>
                <div className="card-body">
                  <div className="fw-semibold mb-2">Plan y tarifa</div>

                  <div className="mb-3">
                    <label className="form-label">Plan</label>
                    <select className="form-select" value={plan}
                      onChange={(e) => setPlan(e.target.value)}>
                      {planes.map((p) => (
                        <option key={p.codigo} value={p.codigo}>
                          {p.codigo}{p.descripcion ? ` — ${p.descripcion}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-3 rounded" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                    {cargandoTarifa ? (
                      <div className="d-flex align-items-center gap-2">
                        <div className="spinner-border spinner-border-sm" />
                        <div>Calculando tarifa...</div>
                      </div>
                    ) : tarifaErr ? (
                      <div className="text-danger">{tarifaErr}</div>
                    ) : !tarifa ? (
                      <div className="text-muted">
                        {habNumero ? "Selecciona fechas para calcular." : "Selecciona habitacion y fechas."}
                      </div>
                    ) : (
                      <>
                        <div className="d-flex justify-content-between mb-1">
                          <div className="text-muted">Noches</div>
                          <div className="fw-semibold">{tarifa.noches}</div>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <div className="text-muted">Tarifa / noche</div>
                          <div className="fw-semibold">${money(tarifa.precio_noche)}</div>
                        </div>
                        <hr className="my-2" />
                        <div className="d-flex justify-content-between">
                          <div className="fw-semibold">Total estimado</div>
                          <div className="fw-bold fs-5">${money(tarifa.total)}</div>
                        </div>
                        <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                          Se guardara como snapshot en la reserva.
                        </div>
                      </>
                    )}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <button
                      className="btn btn-success w-100"
                      onClick={registrar}
                      disabled={guardando || !habNumero || !!tarifaErr || !tarifa}
                    >
                      {guardando ? "Registrando..." : "Registrar"}
                    </button>
                    <button className="btn btn-outline-secondary"
                      onClick={() => nav(-1)} disabled={guardando}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}