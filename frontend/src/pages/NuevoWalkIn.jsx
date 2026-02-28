import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const TIPOS_DOC = [
  { value: "", label: "Seleccione..." },
  { value: "CC", label: "Cédula (CC)" },
  { value: "CE", label: "Cédula extranjería (CE)" },
  { value: "PA", label: "Pasaporte (PA)" },
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
  if (x === "C1") return "Clásico 1 (C1)";
  return p || "—";
};

export default function NuevoWalkIn() {
  const nav = useNavigate();
  const q = new URLSearchParams(useLocation().search);

  const [habNumero] = useState(q.get("hab") || "");
  const [desde] = useState(q.get("desde") || "");
  const [hasta] = useState(q.get("hasta") || "");

  //   plan predeterminado + selector
  const [plan, setPlan] = useState("C1");

  //   tipo habitación se carga automático por número
  const [tipoHabitacion, setTipoHabitacion] = useState("");
  const [tipoErr, setTipoErr] = useState("");

  //   tarifa automática
  const [cargandoTarifa, setCargandoTarifa] = useState(false);
  const [tarifaErr, setTarifaErr] = useState("");
  const [tarifa, setTarifa] = useState(null); // {noches, precio_noche, total}

  //   titular
  const [tipoDocumento, setTipoDocumento] = useState("");
  const [documento, setDocumento] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");

  const [nombres, setNombres] = useState("");
  const [primerApellido, setPrimerApellido] = useState("");
  const [segundoApellido, setSegundoApellido] = useState("");

  // (opcionales)
  const [direccion, setDireccion] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [nacionalidad, setNacionalidad] = useState("");

  //    acompañantes
  const [acompanantes, setAcompanantes] = useState([]);

  const addAcompanante = () => {
    setAcompanantes((prev) => [
      ...prev,
      { tipo_documento: "CC", documento: "", nombres: "", primer_apellido: "", segundo_apellido: "" },
    ]);
  };

  const removeAcompanante = (idx) => {
    setAcompanantes((prev) => prev.filter((_, i) => i !== idx));
  };

  const setAcompananteField = (idx, key, value) => {
    setAcompanantes((prev) => {
      const copia = [...prev];
      copia[idx] = { ...copia[idx], [key]: value };
      return copia;
    });
  };

  const [notas, setNotas] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  //    autofill
  const [autocompletando, setAutocompletando] = useState(false);
  const [autofillMsg, setAutofillMsg] = useState("");
  const [huespedEncontrado, setHuespedEncontrado] = useState(null);

  // Evitar que el autofill pise campos que el usuario ya editó
  const touchedRef = useRef({
    nombres: false,
    primerApellido: false,
    segundoApellido: false,
    telefono: false,
    email: false,
    direccion: false,
    ciudad: false,
    nacionalidad: false,
  });

  const nombreCompleto = useMemo(() => {
    return [nombres, primerApellido, segundoApellido]
      .map((s) => (s || "").trim())
      .filter(Boolean)
      .join(" ");
  }, [nombres, primerApellido, segundoApellido]);

  // 1) Cargar tipo de habitación por número
  const cargarTipoHabitacion = async () => {
    setTipoErr("");
    setTipoHabitacion("");

    if (!habNumero) {
      setTipoErr("No se recibió el número de habitación.");
      return;
    }

    try {
      const r = await axios.get(`${API}/api/habitaciones/por-numero/${habNumero}`, {
        headers: getAuthHeaders(),
      });
      setTipoHabitacion((r.data?.tipo || "").toString().trim());
    } catch (e) {
      console.error("Error cargando tipo habitación:", e);
      setTipoErr(e?.response?.data?.message || "No se pudo cargar el tipo de habitación.");
    }
  };

  // 2) Cargar tarifa automática (según tipo + plan + fechas)
  const cargarTarifa = async () => {
    setTarifaErr("");
    setTarifa(null);

    if (!tipoHabitacion) {
      setTarifaErr("No se pudo determinar el tipo de habitación.");
      return;
    }
    if (!desde || !hasta) {
      setTarifaErr("Rango de fechas incompleto.");
      return;
    }

    try {
      setCargandoTarifa(true);
      const r = await axios.get(`${API}/api/reservas/previsualizarPrecioReserva`, {
        params: { tipo: tipoHabitacion, plan, desde, hasta },
        headers: getAuthHeaders(),
      });
      setTarifa(r.data);
    } catch (e) {
      console.error("Error cargando tarifa:", e);
      setTarifaErr(e?.response?.data?.message || "No se pudo cargar la tarifa.");
    } finally {
      setCargandoTarifa(false);
    }
  };

  useEffect(() => {
    cargarTipoHabitacion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habNumero]);

  useEffect(() => {
    if (tipoHabitacion) cargarTarifa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoHabitacion, plan, desde, hasta]);

  // 3)   Autocompletar Zeus por documento (debounce)
  useEffect(() => {
    setAutofillMsg("");
    setHuespedEncontrado(null);

    const td = (tipoDocumento || "").trim().toUpperCase();
    const doc = (documento || "").trim();

    if (!td || doc.length < 5) return;

    const t = setTimeout(async () => {
      try {
        setAutocompletando(true);

        const r = await axios.get(`${API}/api/huespedes/buscar`, {
          params: { tipo_documento: td, documento: doc },
          headers: getAuthHeaders(),
        });

        const h = r.data;
        setHuespedEncontrado(h);
        setAutofillMsg("Huésped encontrado. Datos autocompletados.");

        if (!touchedRef.current.nombres && !nombres.trim()) setNombres(h.nombres || "");
        if (!touchedRef.current.primerApellido && !primerApellido.trim())
          setPrimerApellido(h.primer_apellido || "");
        if (!touchedRef.current.segundoApellido && !segundoApellido.trim())
          setSegundoApellido(h.segundo_apellido || "");

        if (!touchedRef.current.telefono && !telefono.trim()) setTelefono(h.telefono || "");
        if (!touchedRef.current.email && !email.trim()) setEmail(h.email || "");

        if (!touchedRef.current.direccion && !direccion.trim()) setDireccion(h.direccion || "");
        if (!touchedRef.current.ciudad && !ciudad.trim()) setCiudad(h.ciudad || "");
        if (!touchedRef.current.nacionalidad && !nacionalidad.trim())
          setNacionalidad(h.nacionalidad || "");
      } catch (e) {
        if (e?.response?.status === 404) {
          setAutofillMsg("No existe huésped con ese documento. Puedes registrarlo.");
          setHuespedEncontrado(null);
          return;
        }
        console.error("Autofill huesped error:", e);
        setAutofillMsg(e?.response?.data?.message || "No se pudo autocompletar el huésped.");
      } finally {
        setAutocompletando(false);
      }
    }, 500);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipoDocumento, documento]);

  const registrar = async () => {
    setError("");

    if (!nombres.trim() || !primerApellido.trim()) {
      setError("Nombres y primer apellido son obligatorios.");
      return;
    }
    if (!tipoDocumento || !documento.trim()) {
      setError("Tipo de documento y número de documento son obligatorios para Walk-In.");
      return;
    }

    if (!tarifa || !Number(tarifa.total) || tarifaErr) {
      setError("No hay tarifa cargada. Verifica plan/tipo/fechas.");
      return;
    }

    //   validar acompañantes: si hay documento, debe haber tipo (y viceversa)
    for (const a of acompanantes) {
      const td = (a.tipo_documento || "").trim();
      const doc = (a.documento || "").trim();
      if ((td && !doc) || (!td && doc)) {
        setError("En acompañantes: completa tipo y documento (o deja ambos vacíos).");
        return;
      }
    }

    const tarifa_snapshot = {
      plan,
      plan_label: planLabel(plan),
      tipo_habitacion: tipoHabitacion,
      desde,
      hasta,
      noches: Number(tarifa.noches || 1),
      precio_noche: Number(tarifa.precio_noche || 0),
      total: Number(tarifa.total || 0),
      moneda: "COP",
      generado_en: new Date().toISOString(),
    };

    try {
      setGuardando(true);

      await axios.post(
        `${API}/api/reservas`,
        {
          tipo: "walkin",
          habitacion_numero: habNumero,
          fecha_inicio: desde,
          fecha_fin: hasta,

          //   datos huésped titular
          tipo_documento: tipoDocumento,
          huesped_documento: documento.trim(),
          huesped_telefono: telefono.trim() || null,
          huesped_email: email.trim() || null,

          nombres: nombres.trim(),
          primer_apellido: primerApellido.trim(),
          segundo_apellido: segundoApellido.trim() || null,

          // (opcionales)
          direccion: direccion.trim() || null,
          ciudad: ciudad.trim() || null,
          nacionalidad: nacionalidad.trim() || null,

          // compat
          huesped_nombre: nombreCompleto,

          notas: notas.trim() || null,

          plan,
          tarifa_snapshot,

          //  acompañantes
          acompanantes,
        },
        { headers: getAuthHeaders() }
      );

      nav("/calendario");
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo registrar el Walk-In.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="container" style={{ maxWidth: 980, paddingTop: 18, paddingBottom: 24 }}>
      <div className="card shadow-sm">
        <div className="card-body" style={{ padding: 22 }}>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h3 className="mb-0">Registrar Walk-In</h3>
              <div className="text-muted">
                Entrada inmediata del huésped con plan y tarifa automáticos.
              </div>
            </div>

            <div className="text-end">
              <div>
                <b>Habitación:</b> {habNumero || "—"}
              </div>
              <div>
                <b>Rango:</b> {desde || "—"} → {hasta || "—"}
              </div>
              {tipoHabitacion ? (
                <div className="text-muted">
                  <b>Tipo:</b> {tipoHabitacion}
                </div>
              ) : tipoErr ? (
                <div className="text-danger">{tipoErr}</div>
              ) : null}
            </div>
          </div>

          <hr />

          {error && <div className="alert alert-danger mt-2">{error}</div>}

          {autofillMsg && (
            <div className={`alert ${huespedEncontrado ? "alert-success" : "alert-secondary"} py-2`}>
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-2">
                <div>{autofillMsg}</div>
                {autocompletando && <small className="text-muted">Buscando...</small>}
              </div>
            </div>
          )}

          <div className="row g-3">
            {/* IZQUIERDA: datos titular + acompañantes */}
            <div className="col-md-7">
              <div className="card border-0" style={{ background: "#f8fafc" }}>
                <div className="card-body">
                  <div className="fw-semibold mb-2">Titular</div>

                  <div className="row g-2">
                    <div className="col-md-4">
                      <label className="form-label">Tipo doc. *</label>
                      <select
                        className="form-select"
                        value={tipoDocumento}
                        onChange={(e) => setTipoDocumento(e.target.value)}
                      >
                        {TIPOS_DOC.map((x) => (
                          <option key={x.value} value={x.value}>
                            {x.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-md-8">
                      <label className="form-label">Documento *</label>
                      <input
                        className="form-control"
                        value={documento}
                        onChange={(e) => setDocumento(e.target.value)}
                        placeholder="Ej: 123456789"
                      />
                      <div className="form-text">
                        Al escribir, se autocompleta si ya existe en el sistema.
                      </div>
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Nombres *</label>
                      <input
                        className="form-control"
                        value={nombres}
                        onChange={(e) => {
                          touchedRef.current.nombres = true;
                          setNombres(e.target.value);
                        }}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Primer apellido *</label>
                      <input
                        className="form-control"
                        value={primerApellido}
                        onChange={(e) => {
                          touchedRef.current.primerApellido = true;
                          setPrimerApellido(e.target.value);
                        }}
                      />
                    </div>

                    <div className="col-md-4">
                      <label className="form-label">Segundo apellido</label>
                      <input
                        className="form-control"
                        value={segundoApellido}
                        onChange={(e) => {
                          touchedRef.current.segundoApellido = true;
                          setSegundoApellido(e.target.value);
                        }}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Teléfono</label>
                      <input
                        className="form-control"
                        value={telefono}
                        onChange={(e) => {
                          touchedRef.current.telefono = true;
                          setTelefono(e.target.value);
                        }}
                        placeholder="Ej: 3001234567"
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Email</label>
                      <input
                        className="form-control"
                        value={email}
                        onChange={(e) => {
                          touchedRef.current.email = true;
                          setEmail(e.target.value);
                        }}
                        placeholder="correo@..."
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label">Dirección</label>
                      <input
                        className="form-control"
                        value={direccion}
                        onChange={(e) => {
                          touchedRef.current.direccion = true;
                          setDireccion(e.target.value);
                        }}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">Ciudad</label>
                      <input
                        className="form-control"
                        value={ciudad}
                        onChange={(e) => {
                          touchedRef.current.ciudad = true;
                          setCiudad(e.target.value);
                        }}
                      />
                    </div>

                    <div className="col-md-3">
                      <label className="form-label">Nacionalidad</label>
                      <input
                        className="form-control"
                        value={nacionalidad}
                        onChange={(e) => {
                          touchedRef.current.nacionalidad = true;
                          setNacionalidad(e.target.value);
                        }}
                      />
                    </div>

                    <div className="col-12">
                      <div className="text-muted">
                        Nombre completo (auto): <b>{nombreCompleto || "—"}</b>
                      </div>
                    </div>

                    <div className="col-12">
                      <label className="form-label">Notas internas</label>
                      <textarea
                        className="form-control"
                        rows={3}
                        value={notas}
                        onChange={(e) => setNotas(e.target.value)}
                      />
                    </div>
                  </div>

                  {/*   NUEVO: Acompañantes */}
                  <hr className="my-4" />
                  <div className="d-flex align-items-center justify-content-between">
                    <div className="fw-semibold">Acompañantes</div>
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm"
                      onClick={addAcompanante}
                      disabled={guardando}
                    >
                      ➕ Agregar
                    </button>
                  </div>

                  {acompanantes.length === 0 ? (
                    <div className="text-muted mt-2">Sin acompañantes.</div>
                  ) : (
                    <div className="mt-3">
                      {acompanantes.map((a, idx) => (
                        <div key={idx} className="border rounded p-3 mb-2" style={{ background: "#fff" }}>
                          <div className="d-flex justify-content-between align-items-center mb-2">
                            <div className="fw-semibold">Acompañante #{idx + 1}</div>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => removeAcompanante(idx)}
                              disabled={guardando}
                            >
                              Quitar
                            </button>
                          </div>

                          <div className="row g-2">
                            <div className="col-md-4">
                              <label className="form-label">Tipo doc.</label>
                              <select
                                className="form-select"
                                value={a.tipo_documento}
                                onChange={(e) => setAcompananteField(idx, "tipo_documento", e.target.value)}
                              >
                                {TIPOS_DOC.filter(x => x.value).map((x) => (
                                  <option key={x.value} value={x.value}>
                                    {x.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <div className="col-md-8">
                              <label className="form-label">Documento</label>
                              <input
                                className="form-control"
                                value={a.documento}
                                onChange={(e) => setAcompananteField(idx, "documento", e.target.value)}
                              />
                            </div>

                            <div className="col-md-4">
                              <label className="form-label">Nombres</label>
                              <input
                                className="form-control"
                                value={a.nombres}
                                onChange={(e) => setAcompananteField(idx, "nombres", e.target.value)}
                              />
                            </div>

                            <div className="col-md-4">
                              <label className="form-label">Primer apellido</label>
                              <input
                                className="form-control"
                                value={a.primer_apellido}
                                onChange={(e) => setAcompananteField(idx, "primer_apellido", e.target.value)}
                              />
                            </div>

                            <div className="col-md-4">
                              <label className="form-label">Segundo apellido</label>
                              <input
                                className="form-control"
                                value={a.segundo_apellido}
                                onChange={(e) => setAcompananteField(idx, "segundo_apellido", e.target.value)}
                              />
                            </div>

                            <div className="col-12">
                              <div className="form-text text-muted">
                                Recomendado: al menos Tipo doc y Documento.
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                </div>
              </div>
            </div>

            {/* DERECHA: Plan y tarifa */}
            <div className="col-md-5">
              <div className="card border-0" style={{ background: "#f8fafc" }}>
                <div className="card-body">
                  <div className="fw-semibold mb-2">Plan y tarifa</div>

                  <div className="mb-2">
                    <label className="form-label">Plan</label>
                    <select className="form-select" value={plan} onChange={(e) => setPlan(e.target.value)}>
                      <option value="C1">Clásico 1 (C1)</option>
                      <option value="GK">Gold King (GK)</option>
                    </select>
                  </div>

                  <div className="p-3 rounded" style={{ background: "#fff", border: "1px solid #e5e7eb" }}>
                    {cargandoTarifa ? (
                      <div className="d-flex align-items-center gap-2">
                        <div className="spinner-border spinner-border-sm" />
                        <div>Cargando tarifa...</div>
                      </div>
                    ) : tarifaErr ? (
                      <div className="text-danger">{tarifaErr}</div>
                    ) : !tarifa ? (
                      <div className="text-muted">No hay tarifa calculada.</div>
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
                          Se guardará como snapshot en la reserva.
                        </div>
                      </>
                    )}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <button
                      className="btn btn-success w-100"
                      onClick={registrar}
                      disabled={guardando || !!tarifaErr || !tarifa}
                    >
                      {guardando ? "Registrando..." : "Registrar"}
                    </button>
                    <button className="btn btn-outline-secondary" onClick={() => nav(-1)} disabled={guardando}>
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
