// src/pages/RegistroReserva.jsx
// Expediente del huésped: quien está, con quién, gestión de estadía
// Separado del folio financiero (CargosReserva)

import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";

const API = "http://localhost:4000";
const getH = () => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};
const fmtF = (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "—");

// ── Paleta ──────────────────────────────────────────────────────────────────
const C = {
  navy:    "#1a1a2e",
  blue:    "#2563eb",
  green:   "#16a34a",
  red:     "#dc2626",
  amber:   "#d97706",
  gray:    "#6b7280",
  light:   "#f8fafc",
  border:  "#e2e8f0",
  white:   "#ffffff",
};

const ESTADO_BADGE = {
  ocupada:    { bg: C.red,   label: "Ocupada" },
  reservada:  { bg: C.blue,  label: "Reservada" },
  finalizada: { bg: C.green, label: "Finalizada" },
  cancelada:  { bg: C.gray,  label: "Cancelada" },
  no_show:    { bg: C.amber, label: "No Show" },
};

// ── Estilos base ─────────────────────────────────────────────────────────────
const card = {
  background: C.white, border: `1px solid ${C.border}`,
  borderRadius: 12, padding: 24, marginBottom: 16,
};
const sectionTitle = {
  fontSize: 11, fontWeight: 700, color: C.gray,
  letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 16,
};
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, fontSize: 14 };
const label = { color: C.gray };
const value = { color: C.navy, fontWeight: 500 };
const inputS = {
  border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px",
  fontSize: 14, width: "100%", outline: "none", color: C.navy,
};
const btnPrim = {
  background: C.blue, color: C.white, border: "none", borderRadius: 8,
  padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const btnSec = {
  background: C.white, color: C.navy, border: `1px solid ${C.border}`,
  borderRadius: 8, padding: "9px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
};
const btnGreen  = { ...btnPrim, background: C.green };

// ── Componentes pequeños ─────────────────────────────────────────────────────
const Divider = () => <div style={{ borderTop: `1px solid ${C.border}`, margin: "16px 0" }} />;

const Tag = ({ children, color = C.blue }) => (
  <span style={{
    background: color + "18", color, border: `1px solid ${color}40`,
    borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600,
  }}>{children}</span>
);

const Alert = ({ msg, type = "error" }) => {
  if (!msg) return null;
  const colors = { error: [C.red, "#fef2f2"], success: [C.green, "#f0fdf4"], warn: [C.amber, "#fffbeb"] };
  const [c, bg] = colors[type] || colors.error;
  return (
    <div style={{ background: bg, border: `1px solid ${c}40`, borderRadius: 8, padding: "10px 16px", color: c, fontSize: 13, marginBottom: 12 }}>
      {msg}
    </div>
  );
};

// ── Página principal ─────────────────────────────────────────────────────────
export default function RegistroReserva() {
  const { id }   = useParams();
  const navigate = useNavigate();

  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [reserva,  setReserva]  = useState(null);
  const [huespedes, setHuespedes] = useState([]);
  const [planes,   setPlanes]   = useState([]);
  const [habitaciones, setHabs] = useState([]);

  // Paneles activos
  const [panel, setPanel] = useState(null); // "extender"|"cambiarHab"|"cambiarPlan"|"notas"|"acompanante"

  // Formularios
  const [nuevaFechaFin,  setNuevaFechaFin]  = useState("");
  const [nuevaHab,       setNuevaHab]       = useState("");
  const [nuevoPlan,      setNuevoPlan]      = useState("");
  const [nuevasNotas,    setNuevasNotas]    = useState("");
  const [guardando,      setGuardando]      = useState(false);
  const [msgOp,          setMsgOp]          = useState({ text: "", type: "error" });

  // Nuevo acompañante
  const COMP_VACIO = { tipo_documento: "CC", documento: "", nombres: "", primer_apellido: "", segundo_apellido: "", telefono: "", email: "" };
  const [comp,      setComp]      = useState(COMP_VACIO);
  const [msgComp,   setMsgComp]   = useState({ text: "", type: "error" });
  const [guardandoComp, setGuardandoComp] = useState(false);

  // ── Carga inicial ────────────────────────────────────────────────────────
  const descargarPDF = async () => {
    try {
      const response = await axios.get(`${API}/api/reservas/${id}/registro-hotelero`, {
        headers: getH(),
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
      const a   = document.createElement("a");
      a.href     = url;
      a.download = `registro_hotelero_${id}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.response?.data?.message || "Error al generar el PDF del registro hotelero.");
    }
  };

  const [tarifa,    setTarifa]    = useState(null); // { precio_noche, noches, total }
  const [descuentos, setDescuentos] = useState([]); // movimientos tipo='descuento'

  const cargarPlanes = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/api/planes`, { headers: getH() });
      setPlanes(Array.isArray(data) ? data.filter(p => p.activo) : []);
    } catch { setPlanes([]); }
  }, []);

  const cargarTarifa = useCallback(async (reservaData) => {
    if (!reservaData) return;
    try {
      const { data } = await axios.get(`${API}/api/reservas/precio`, {
        params: {
          tipo: reservaData.habitacion_tipo,
          plan: reservaData.plan,
          desde: String(reservaData.fecha_inicio).slice(0, 10),
          hasta: String(reservaData.fecha_fin).slice(0, 10),
        },
        headers: getH(),
      });
      setTarifa(data);
    } catch { setTarifa(null); }
  }, []);

  const cargar = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [rRes, rHuespedes, rFinanzas] = await Promise.all([
        axios.get(`${API}/api/reservas/${id}`, { headers: getH() }),
        axios.get(`${API}/api/reservas/${id}/huespedes-asociados`, { headers: getH() }),
        axios.get(`${API}/api/reservas/${id}/finanzas`, { headers: getH() }).catch(() => null),
      ]);
      const res = rRes.data?.reserva || rRes.data;
      setReserva(res);
      setHuespedes(Array.isArray(rHuespedes.data) ? rHuespedes.data : []);
      cargarTarifa(res);
      const movs = rFinanzas?.data?.movimientos || [];
      setDescuentos(movs.filter(m => m.tipo === "descuento"));
    } catch (e) {
      setErr(e?.response?.data?.message || "No se pudo cargar el registro.");
    } finally { setLoading(false); }
  }, [id, cargarTarifa]);

  const cargarHabs = useCallback(async () => {
    if (!reserva) return;
    try {
      const { data } = await axios.get(`${API}/api/habitaciones`, { headers: getH() });
      const lista = (Array.isArray(data) ? data : []).filter(
        (h) => h.activo && h.estado === "disponible" && String(h.numero) !== String(reserva.habitacion_numero)
      );
      setHabs(lista);
    } catch { setHabs([]); }
  }, [reserva]);

  useEffect(() => { cargar(); cargarPlanes(); }, [cargar, cargarPlanes]);

  // ── Acciones de estadía ──────────────────────────────────────────────────
  const abrirPanel = (p) => {
    setPanel(p === panel ? null : p);
    setMsgOp({ text: "", type: "error" });
    if (p === "cambiarHab" && habitaciones.length === 0) cargarHabs();
    if (p === "cambiarPlan" && reserva) setNuevoPlan(reserva.plan || (planes[0]?.codigo ?? planes[0] ?? ""));
    if (p === "extender"   && reserva) setNuevaFechaFin(dayjs(reserva.fecha_fin).format("YYYY-MM-DD"));
    if (p === "notas"      && reserva) setNuevasNotas(reserva.notas || "");
  };

  const op = async (body, successMsg) => {
    setGuardando(true); setMsgOp({ text: "", type: "error" });
    try {
      if (body._extender) {
        await axios.post(`${API}/api/reservas/${id}/extender`, { nueva_fecha_fin: body.nueva_fecha_fin }, { headers: getH() });
      } else {
        await axios.put(`${API}/api/reservas/${id}`, body, { headers: getH() });
      }
      setMsgOp({ text: successMsg, type: "success" });
      setPanel(null);
      await cargar();
    } catch (e) {
      setMsgOp({ text: e?.response?.data?.message || "Error al guardar.", type: "error" });
    } finally { setGuardando(false); }
  };

  const extender     = () => {
    if (!nuevaFechaFin) return setMsgOp({ text: "Selecciona la nueva fecha de salida.", type: "error" });
    op({ _extender: true, nueva_fecha_fin: nuevaFechaFin }, "Estadía extendida correctamente.");
  };
  const cambiarHab   = () => {
    if (!nuevaHab) return setMsgOp({ text: "Selecciona una habitación.", type: "error" });
    op({ habitacion_numero: nuevaHab }, "Habitación cambiada correctamente.");
  };
  const cambiarPlan  = () => {
    if (!nuevoPlan) return setMsgOp({ text: "Selecciona un plan.", type: "error" });
    op({ plan: nuevoPlan }, "Plan actualizado correctamente.");
  };
  const guardarNotas = () => op({ notas: nuevasNotas }, "Notas actualizadas.");

  // ── Agregar acompañante ──────────────────────────────────────────────────
  const agregarAcompanante = async () => {
    setMsgComp({ text: "", type: "error" });
    if (!comp.documento.trim())      return setMsgComp({ text: "Documento obligatorio.", type: "error" });
    if (!comp.nombres.trim())        return setMsgComp({ text: "Nombres obligatorio.", type: "error" });
    if (!comp.primer_apellido.trim())return setMsgComp({ text: "Primer apellido obligatorio.", type: "error" });
    try {
      setGuardandoComp(true);
      const actuales = huespedes.filter((h) => h.rol !== "titular").map((h) => ({
        tipo_documento: h.tipo_documento, documento: h.documento,
        nombres: h.nombre_completo?.split(" ")[0] || h.nombre_completo,
        primer_apellido: h.nombre_completo?.split(" ")[1] || "",
        segundo_apellido: h.nombre_completo?.split(" ")[2] || "",
        telefono: h.telefono || "", email: h.email || "",
      }));
      await axios.put(
        `${API}/api/reservas/${id}/acompanantes`,
        { acompanantes: [...actuales, comp] },
        { headers: getH() }
      );
      setComp(COMP_VACIO);
      setMsgComp({ text: "Acompañante agregado correctamente.", type: "success" });
      setPanel(null);
      await cargar();
    } catch (e) {
      setMsgComp({ text: e?.response?.data?.message || "Error al agregar acompañante.", type: "error" });
    } finally { setGuardandoComp(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ textAlign: "center", padding: 60, color: C.gray }}>Cargando registro...</div>
  );
  if (err) return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: 24 }}>
      <Alert msg={err} />
      <button onClick={() => navigate(-1)} style={btnSec}>Volver</button>
    </div>
  );
  if (!reserva) return null;

  const titular = huespedes.find((h) => h.rol === "titular");
  const acomps  = huespedes.filter((h) => h.rol !== "titular");
  const badgeR  = ESTADO_BADGE[reserva.estado] || { bg: C.gray, label: reserva.estado };
  const editable = ["ocupada", "reservada"].includes(reserva.estado);

  const btnAccion = (key, label, color = C.navy) => (
    <button
      key={key}
      onClick={() => abrirPanel(key)}
      style={{
        background: panel === key ? color : C.white,
        color: panel === key ? C.white : color,
        border: `1.5px solid ${color}`,
        borderRadius: 8, padding: "8px 16px", fontSize: 13,
        fontWeight: 600, cursor: "pointer", transition: "all .15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>

      {/* ── Encabezado ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.navy }}>
              Registro — Reserva #{id}
            </h2>
            <span style={{ background: badgeR.bg, color: C.white, padding: "3px 12px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
              {badgeR.label}
            </span>
          </div>
          <div style={{ color: C.gray, fontSize: 13 }}>
            Expediente del huésped y gestión de la estadía.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => navigate(`/folio/${id}`)} style={{ ...btnSec, fontSize: 13 }}>
            Ver folio / cargos
          </button>
          {reserva.estado === "ocupada" && (
            <button onClick={() => navigate(`/facturacion/${id}`)} style={{ ...btnGreen, fontSize: 13 }}>
              Check-out / Facturar
            </button>
          )}
          <button onClick={descargarPDF} style={{ ...btnSec, fontSize: 13, borderColor: C.navy, color: C.navy }}>
            Descargar registro PDF
          </button>
          <button onClick={() => navigate(-1)} style={{ ...btnSec, fontSize: 13 }}>Volver</button>
        </div>
      </div>

      {/* ── Datos de la estadía ── */}
      <div style={card}>
        <div style={sectionTitle}>Datos de la estadía</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 32px" }}>
          <div style={row}><span style={label}>Habitación</span><span style={value}>{reserva.habitacion_numero} — {reserva.habitacion_tipo}</span></div>
          <div style={row}><span style={label}>Plan</span><Tag>{reserva.plan || "—"}</Tag></div>
          <div style={row}><span style={label}>Check-in</span><span style={value}>{fmtF(reserva.fecha_inicio)}</span></div>
          <div style={row}><span style={label}>Check-out</span><span style={value}>{fmtF(reserva.fecha_fin)}</span></div>
          <div style={row}><span style={label}>Noches</span><span style={value}>{dayjs(reserva.fecha_fin).diff(dayjs(reserva.fecha_inicio), "day")}</span></div>
          <div style={row}><span style={label}>Fuente</span><span style={value}>{reserva.fuente || "—"}</span></div>
          <div style={row}>
            <span style={label}>Tarifa / noche</span>
            <span style={{ ...value, color: tarifa ? C.green : C.gray }}>
              {tarifa
                ? Number(tarifa.precio_noche).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
                : "Sin tarifa para este plan/fechas"}
            </span>
          </div>
          <div style={row}>
            <span style={label}>Total alojamiento</span>
            <span style={{ ...value, fontWeight: 700, color: tarifa ? C.navy : C.gray }}>
              {tarifa
                ? Number(tarifa.total).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
                : "—"}
            </span>
          </div>
          {descuentos.length > 0 && (() => {
            const totalDesc = descuentos.reduce((s, d) => s + Number(d.monto || 0), 0);
            const totalConDesc = tarifa ? Number(tarifa.total) - totalDesc : null;
            return (
              <>
                {descuentos.map(d => (
                  <div key={d.id} style={{ ...row, gridColumn: "1 / -1" }}>
                    <span style={{ color: C.green, fontSize: 13 }}>
                      🏷 {String(d.referencia || "Descuento").replace(/\[PROMO-\d+\]/, "").trim()}
                    </span>
                    <span style={{ color: C.green, fontWeight: 600 }}>
                      -{Number(d.monto).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                    </span>
                  </div>
                ))}
                {totalConDesc !== null && (
                  <div style={{ ...row, gridColumn: "1 / -1", borderTop: `1px solid ${C.border}`, paddingTop: 8, marginTop: 4 }}>
                    <span style={{ ...label, fontWeight: 700, color: C.navy }}>Total con descuento</span>
                    <span style={{ ...value, fontWeight: 800, fontSize: 16, color: C.green }}>
                      {totalConDesc.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}
              </>
            );
          })()}
          {reserva.notas && (
            <div style={{ ...row, gridColumn: "1 / -1" }}>
              <span style={label}>Notas</span>
              <span style={{ ...value, maxWidth: 400, textAlign: "right" }}>{reserva.notas}</span>
            </div>
          )}
        </div>

        {/* Acciones de estadía */}
        {editable && (
          <>
            <Divider />
            <div style={{ fontSize: 12, color: C.gray, marginBottom: 10, fontWeight: 600 }}>MODIFICAR ESTADÍA</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {btnAccion("extender",    "Extender estadía",      C.green)}
              {btnAccion("cambiarHab",  "Cambiar habitación",    C.blue)}
              {btnAccion("cambiarPlan", "Cambiar plan",          C.amber)}
              {btnAccion("notas",       "Editar notas",          C.navy)}
            </div>

            {/* Panel: Extender */}
            {panel === "extender" && (
              <div style={{ marginTop: 16, padding: 16, background: C.light, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Nueva fecha de salida</div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <input type="date" style={{ ...inputS, width: "auto" }}
                    value={nuevaFechaFin} min={dayjs(reserva.fecha_fin).add(1, "day").format("YYYY-MM-DD")}
                    onChange={(e) => setNuevaFechaFin(e.target.value)} />
                  <button onClick={extender} disabled={guardando} style={btnGreen}>
                    {guardando ? "Guardando..." : "Confirmar extensión"}
                  </button>
                  <button onClick={() => setPanel(null)} style={btnSec}>Cancelar</button>
                </div>
                <Alert msg={msgOp.text} type={msgOp.type} />
              </div>
            )}

            {/* Panel: Cambiar habitación */}
            {panel === "cambiarHab" && (
              <div style={{ marginTop: 16, padding: 16, background: C.light, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Habitaciones disponibles</div>
                {habitaciones.length === 0 ? (
                  <div style={{ color: C.gray, fontSize: 13 }}>No hay habitaciones disponibles para cambio.</div>
                ) : (
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <select style={{ ...inputS, width: "auto", minWidth: 200 }}
                      value={nuevaHab} onChange={(e) => setNuevaHab(e.target.value)}>
                      <option value="">Selecciona habitación...</option>
                      {habitaciones.map((h) => (
                        <option key={h.id} value={h.numero}>
                          {h.numero} — {h.tipo} (disponible)
                        </option>
                      ))}
                    </select>
                    <button onClick={cambiarHab} disabled={guardando} style={btnPrim}>
                      {guardando ? "Cambiando..." : "Confirmar cambio"}
                    </button>
                    <button onClick={() => setPanel(null)} style={btnSec}>Cancelar</button>
                  </div>
                )}
                <Alert msg={msgOp.text} type={msgOp.type} />
              </div>
            )}

            {/* Panel: Cambiar plan */}
            {panel === "cambiarPlan" && (
              <div style={{ marginTop: 16, padding: 16, background: C.light, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>
                  Plan actual: <Tag>{reserva.plan || "—"}</Tag>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <select style={{ ...inputS, width: "auto", minWidth: 200 }}
                    value={nuevoPlan} onChange={(e) => setNuevoPlan(e.target.value)}>
                    {planes.length === 0
                      ? <option value="">Sin planes — ve a Administración → Planes</option>
                      : planes.map((p) => {
                          const cod = p.codigo ?? p;
                          const desc = p.descripcion;
                          return <option key={cod} value={cod}>{cod}{desc ? ` — ${desc}` : ""}</option>;
                        })
                    }
                  </select>
                  <button onClick={cambiarPlan} disabled={guardando} style={{ ...btnPrim, background: C.amber }}>
                    {guardando ? "Cambiando..." : "Confirmar cambio"}
                  </button>
                  <button onClick={() => setPanel(null)} style={btnSec}>Cancelar</button>
                </div>
                <Alert msg={msgOp.text} type={msgOp.type} />
              </div>
            )}

            {/* Panel: Notas */}
            {panel === "notas" && (
              <div style={{ marginTop: 16, padding: 16, background: C.light, borderRadius: 8 }}>
                <div style={{ fontWeight: 600, marginBottom: 10, fontSize: 14 }}>Notas de la reserva</div>
                <textarea
                  rows={3} style={{ ...inputS, resize: "vertical" }}
                  value={nuevasNotas} onChange={(e) => setNuevasNotas(e.target.value)}
                  placeholder="Observaciones, requerimientos especiales, etc."
                />
                <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                  <button onClick={guardarNotas} disabled={guardando} style={btnPrim}>
                    {guardando ? "Guardando..." : "Guardar notas"}
                  </button>
                  <button onClick={() => setPanel(null)} style={btnSec}>Cancelar</button>
                </div>
                <Alert msg={msgOp.text} type={msgOp.type} />
              </div>
            )}

            {/* Mensaje de operación exitosa cuando no hay panel abierto */}
            {!panel && msgOp.text && <Alert msg={msgOp.text} type={msgOp.type} />}
          </>
        )}
      </div>

      {/* ── Huésped titular ── */}
      <div style={card}>
        <div style={sectionTitle}>Huésped titular</div>
        {titular ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 32px" }}>
            <div style={row}><span style={label}>Nombre</span><span style={value}>{titular.nombre_completo || reserva.huesped_nombre || "—"}</span></div>
            <div style={row}><span style={label}>Documento</span><span style={value}>{titular.tipo_documento} {titular.documento}</span></div>
            {titular.telefono && <div style={row}><span style={label}>Teléfono</span><span style={value}>{titular.telefono}</span></div>}
            {titular.email    && <div style={row}><span style={label}>Email</span><span style={value}>{titular.email}</span></div>}
            {titular.nacionalidad && <div style={row}><span style={label}>Nacionalidad</span><span style={value}>{titular.nacionalidad}</span></div>}
          </div>
        ) : (
          <div style={{ color: C.gray, fontSize: 14 }}>
            {reserva.huesped_nombre || "—"}
          </div>
        )}
      </div>

      {/* ── Acompañantes ── */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={sectionTitle}>Acompañantes ({acomps.length})</div>
          {editable && (
            <button
              onClick={() => abrirPanel("acompanante")}
              style={{
                background: panel === "acompanante" ? C.blue : C.white,
                color: panel === "acompanante" ? C.white : C.blue,
                border: `1.5px solid ${C.blue}`, borderRadius: 8,
                padding: "6px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              + Agregar acompañante
            </button>
          )}
        </div>

        {acomps.length === 0 && panel !== "acompanante" && (
          <div style={{ color: C.gray, fontSize: 14, padding: "8px 0" }}>
            No hay acompañantes registrados.
          </div>
        )}

        {acomps.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, marginBottom: 8 }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.border}` }}>
                {["Nombre", "Documento", "Teléfono", "Email"].map((h) => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: C.gray, fontWeight: 600, fontSize: 12 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {acomps.map((a) => (
                <tr key={a.id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: "10px 8px", color: C.navy, fontWeight: 500 }}>{a.nombre_completo}</td>
                  <td style={{ padding: "10px 8px", color: C.gray }}>{a.tipo_documento} {a.documento}</td>
                  <td style={{ padding: "10px 8px", color: C.gray }}>{a.telefono || "—"}</td>
                  <td style={{ padding: "10px 8px", color: C.gray }}>{a.email    || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Formulario agregar acompañante */}
        {panel === "acompanante" && (
          <div style={{ padding: 16, background: C.light, borderRadius: 8, marginTop: 8 }}>
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 14 }}>Datos del acompañante</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>Tipo documento</div>
                <select style={inputS} value={comp.tipo_documento}
                  onChange={(e) => setComp((p) => ({ ...p, tipo_documento: e.target.value }))}>
                  <option value="CC">CC</option>
                  <option value="CE">CE</option>
                  <option value="PA">Pasaporte</option>
                  <option value="TI">TI</option>
                  <option value="NIT">NIT</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>Número documento *</div>
                <input style={inputS} value={comp.documento} placeholder="Ej: 1006210598"
                  onChange={(e) => setComp((p) => ({ ...p, documento: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>Nombres *</div>
                <input style={inputS} value={comp.nombres} placeholder="Ej: María"
                  onChange={(e) => setComp((p) => ({ ...p, nombres: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>Primer apellido *</div>
                <input style={inputS} value={comp.primer_apellido} placeholder="Ej: González"
                  onChange={(e) => setComp((p) => ({ ...p, primer_apellido: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>Segundo apellido</div>
                <input style={inputS} value={comp.segundo_apellido} placeholder="Opcional"
                  onChange={(e) => setComp((p) => ({ ...p, segundo_apellido: e.target.value }))} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>Teléfono</div>
                <input style={inputS} value={comp.telefono} placeholder="Ej: 3155294512"
                  onChange={(e) => setComp((p) => ({ ...p, telefono: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <div style={{ fontSize: 12, color: C.gray, marginBottom: 4 }}>Email</div>
                <input style={inputS} value={comp.email} placeholder="Ej: maria@email.com" type="email"
                  onChange={(e) => setComp((p) => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <Alert msg={msgComp.text} type={msgComp.type} />
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button onClick={agregarAcompanante} disabled={guardandoComp} style={btnPrim}>
                {guardandoComp ? "Guardando..." : "Guardar acompañante"}
              </button>
              <button onClick={() => { setPanel(null); setComp(COMP_VACIO); setMsgComp({ text: "", type: "error" }); }} style={btnSec}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}