// src/pages/OTAs.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import reservasService from "../services/reservasService";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

const getH = () => {
  const t = localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

// ── helpers ──────────────────────────────────────────────────────────────────
const parsePayload = (p) => {
  if (!p) return {};
  if (typeof p === "string") { try { return JSON.parse(p); } catch { return {}; } }
  return p;
};

const PREFIJOS_OTA = [
  { prefijos: ["BDC-"],        label: "Booking.com", color: "#003580", bg: "#dbeafe" },
  { prefijos: ["ABB-","ALC-"], label: "Airbnb",      color: "#ff385c", bg: "#ffe4ea" },
  { prefijos: ["EXP-"],        label: "Expedia",     color: "#f5a623", bg: "#fff3dc" },
  { prefijos: ["HRS-"],        label: "HRS",         color: "#2d6a4f", bg: "#d8f3dc" },
  { prefijos: ["AGOD-"],       label: "Agoda",       color: "#5b21b6", bg: "#ede9fe" },
  { prefijos: ["HB-"],         label: "Hotelbeds",   color: "#0e7490", bg: "#cffafe" },
];

const detectarCanal = (r) => {
  const id  = r.ota_reserva_id || "";
  const pl  = parsePayload(r.ota_payload);
  const uid = pl?.raw?.payload?.booking_unique_id || pl?.booking_unique_id || id;
  for (const ota of PREFIJOS_OTA) {
    if (ota.prefijos.some(p => uid.toUpperCase().startsWith(p) || id.toUpperCase().startsWith(p)))
      return ota;
  }
  if (r.ota_canal === "sandbox") return { label: "Sandbox", color: "#6b7280", bg: "#f3f4f6" };
  if (r.ota_canal || r.fuente)  return { label: "Channex", color: "#2563eb", bg: "#eff6ff" };
  return                               { label: "OTA",     color: "#374151", bg: "#f3f4f6" };
};

const otaIdVisible = (r) => {
  const id = r.ota_reserva_id || "";
  if (!id) return "—";
  return id.replace(/^(BDC|AIR|HMAIR|EXP|HRS|OTA)-/i, "");
};

const ESTADO = {
  reservada:  { bg: "#dbeafe", color: "#1d4ed8" },
  ocupada:    { bg: "#dcfce7", color: "#166534" },
  finalizada: { bg: "#f3f4f6", color: "#374151" },
  cancelada:  { bg: "#fee2e2", color: "#dc2626" },
  no_show:    { bg: "#fef3c7", color: "#d97706" },
};

const fmt = (d) => d ? dayjs(d).format("DD/MM/YYYY") : "—";
const fmtTs = (d) => d ? dayjs(d).format("DD/MM/YY HH:mm") : "—";

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1: Reservas OTA
// ─────────────────────────────────────────────────────────────────────────────
function TabReservas() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filtro, setFiltro]     = useState("todos");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await reservasService.listar({ origen: "ota", limit: 200 });
      const items = Array.isArray(data) ? data : (data.items || []);
      setReservas(items);
    } catch { setReservas([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const conteo = reservas.reduce((acc, r) => {
    const label = detectarCanal(r).label;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const filtradas = filtro === "todos"
    ? reservas
    : reservas.filter(r => detectarCanal(r).label === filtro);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={cargar}
          style={{ background: "#f3f4f6", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
          ↻ Actualizar
        </button>
      </div>

      {Object.keys(conteo).length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {Object.entries(conteo).map(([label, total]) => {
            const r0 = reservas.find(r => detectarCanal(r).label === label);
            const ci = r0 ? detectarCanal(r0) : { color: "#374151", bg: "#f3f4f6" };
            const activo = filtro === label;
            return (
              <div key={label} onClick={() => setFiltro(activo ? "todos" : label)}
                style={{ background: activo ? ci.color : ci.bg, border: `2px solid ${ci.color}`, borderRadius: 10, padding: "12px 22px", cursor: "pointer", minWidth: 120, textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: activo ? "#fff" : ci.color }}>{total}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: activo ? "#ffffffcc" : ci.color }}>{label}</div>
              </div>
            );
          })}
          {filtro !== "todos" && (
            <div onClick={() => setFiltro("todos")}
              style={{ background: "#f8fafc", border: "2px dashed #d1d5db", borderRadius: 10, padding: "12px 22px", cursor: "pointer", minWidth: 100, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>✕ Quitar filtro</span>
            </div>
          )}
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>Cargando...</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin reservas OTA</div>
            <div style={{ fontSize: 13 }}>Cuando Channex reciba una reserva de Booking.com o Airbnb aparecerá aquí automáticamente.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["#", "Canal", "ID OTA", "Huésped", "Habitación", "Check-in", "Check-out", "Noches", "Estado", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r, i) => {
                const ci   = detectarCanal(r);
                const es   = ESTADO[r.estado] || ESTADO.finalizada;
                const noches = r.fecha_inicio && r.fecha_fin ? dayjs(r.fecha_fin).diff(dayjs(r.fecha_inicio), "day") : "—";
                const pl   = parsePayload(r.ota_payload);
                const nombre = r.huesped_nombre || pl?.customer_name || pl?.raw?.payload?.customer_name || "—";
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>#{r.id}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: ci.bg, color: ci.color, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>{ci.label}</span>
                    </td>
                    <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12 }}>{otaIdVisible(r)}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 500 }}>{nombre}</td>
                    <td style={{ padding: "12px 14px" }}>
                      {r.habitacion_numero ? `Hab. ${r.habitacion_numero}` : "—"}
                      {r.habitacion_tipo && <span style={{ color: "#9ca3af", marginLeft: 4, fontSize: 11 }}>— {r.habitacion_tipo}</span>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>{fmt(r.fecha_inicio)}</td>
                    <td style={{ padding: "12px 14px" }}>{fmt(r.fecha_fin)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>{noches}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: es.bg, color: es.color, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>{r.estado}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <button onClick={() => navigate(`/registro/${r.id}`)}
                        style={{ background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 7, padding: "5px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Ver
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2: Configuración (webhook URL + mapeo habitaciones)
// ─────────────────────────────────────────────────────────────────────────────
function TabConfiguracion() {
  const WEBHOOK_URL = `${process.env.REACT_APP_API_URL || "http://localhost:4000"}/api/otas/channex/webhook`;

  const [properties,  setProperties]  = useState([]);
  const [roomTypes,   setRoomTypes]   = useState([]);
  const [mapping,     setMapping]     = useState([]);    // habitaciones con su mapeo actual
  const [propSel,     setPropSel]     = useState("");
  const [loadingProp, setLoadingProp] = useState(false);
  const [loadingRT,   setLoadingRT]   = useState(false);
  const [saving,      setSaving]      = useState({});
  const [edits,       setEdits]       = useState({});    // { hab_id: { property_id, room_type_id } }
  const [msg,         setMsg]         = useState("");

  // Cargar habitaciones con mapeo actual
  useEffect(() => {
    axios.get(`${API}/api/otas/channex/mapping`, { headers: getH() })
      .then(r => {
        setMapping(r.data || []);
        // Inicializar edits con los valores actuales
        const init = {};
        (r.data || []).forEach(h => {
          init[h.id] = {
            property_id:   h.channex_property_id  || "",
            room_type_id:  h.channex_room_type_id || "",
          };
        });
        setEdits(init);
      })
      .catch(() => {});
  }, []);

  const cargarProperties = async () => {
    setLoadingProp(true);
    setMsg("");
    try {
      const r = await axios.get(`${API}/api/otas/channex/properties`, { headers: getH() });
      setProperties(r.data || []);
      if (!r.data?.length) setMsg("No se encontraron propiedades en Channex. Verifica tu API key.");
    } catch (e) {
      setMsg(e?.response?.data?.message || "Error consultando Channex.");
    } finally { setLoadingProp(false); }
  };

  const cargarRoomTypes = async (property_id) => {
    setLoadingRT(true);
    try {
      const r = await axios.get(`${API}/api/otas/channex/room-types`, {
        headers: getH(), params: { property_id }
      });
      setRoomTypes(r.data || []);
    } catch { setRoomTypes([]); }
    finally { setLoadingRT(false); }
  };

  const handlePropChange = (e) => {
    const pid = e.target.value;
    setPropSel(pid);
    if (pid) cargarRoomTypes(pid);
    else setRoomTypes([]);
  };

  const guardarMapeo = async (habId) => {
    const ed = edits[habId] || {};
    setSaving(s => ({ ...s, [habId]: true }));
    setMsg("");
    try {
      await axios.put(`${API}/api/otas/channex/mapping/${habId}`, {
        channex_property_id:  ed.property_id  || null,
        channex_room_type_id: ed.room_type_id || null,
      }, { headers: getH() });
      setMsg(`Mapeo guardado para Hab. ${mapping.find(h => h.id === habId)?.numero}`);
    } catch {
      setMsg("Error guardando mapeo.");
    } finally {
      setSaving(s => ({ ...s, [habId]: false }));
    }
  };

  const copiar = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    setMsg("URL copiada al portapapeles.");
    setTimeout(() => setMsg(""), 3000);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>

      {/* Sección 1: URL del webhook */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 24 }}>
        <h5 style={{ margin: "0 0 4px", color: "#1a1a2e" }}>URL del Webhook</h5>
        <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
          Registra esta URL en <b>Channex → Properties → tu propiedad → Webhooks</b> para recibir reservas automáticamente.
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <code style={{ flex: 1, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13, wordBreak: "break-all" }}>
            {WEBHOOK_URL}
          </code>
          <button onClick={copiar}
            style={{ background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            Copiar
          </button>
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 12, color: "#6b7280" }}>
          En Channex, selecciona el evento <b>booking_new</b>, <b>booking_modified</b> y <b>booking_cancelled</b>.
        </p>
      </div>

      {/* Sección 2: Mapeo de habitaciones */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 24 }}>
        <h5 style={{ margin: "0 0 4px", color: "#1a1a2e" }}>Mapeo de Habitaciones</h5>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
          Asocia cada habitación del hotel con su Room Type en Channex para que la disponibilidad se sincronice correctamente.
        </p>

        {/* Cargar propiedades de Channex */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <button onClick={cargarProperties} disabled={loadingProp}
            style={{ background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {loadingProp ? "Cargando..." : "Cargar propiedades de Channex"}
          </button>

          {properties.length > 0 && (
            <select value={propSel} onChange={handlePropChange}
              style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: "9px 12px", fontSize: 13 }}>
              <option value="">— Selecciona propiedad —</option>
              {properties.map(p => (
                <option key={p.id} value={p.id}>{p.attributes?.title || p.id}</option>
              ))}
            </select>
          )}

          {loadingRT && <span style={{ fontSize: 13, color: "#6b7280" }}>Cargando room types...</span>}
        </div>

        {msg && (
          <div style={{ background: msg.includes("Error") ? "#fee2e2" : "#dcfce7", color: msg.includes("Error") ? "#dc2626" : "#166534", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
            {msg}
          </div>
        )}

        {/* Tabla de mapeo */}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
              {["Hab.", "Tipo", "Property ID (Channex)", "Room Type ID (Channex)", ""].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mapping.map((h, i) => (
              <tr key={h.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                <td style={{ padding: "10px 12px", fontWeight: 700 }}>Hab. {h.numero}</td>
                <td style={{ padding: "10px 12px", color: "#6b7280" }}>{h.tipo}</td>

                {/* Property ID */}
                <td style={{ padding: "8px 12px" }}>
                  {properties.length > 0 ? (
                    <select
                      value={edits[h.id]?.property_id || ""}
                      onChange={e => {
                        setEdits(prev => ({ ...prev, [h.id]: { ...prev[h.id], property_id: e.target.value, room_type_id: "" } }));
                        if (e.target.value && e.target.value !== propSel) {
                          setPropSel(e.target.value);
                          cargarRoomTypes(e.target.value);
                        }
                      }}
                      style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", fontSize: 12, width: "100%" }}>
                      <option value="">— Sin asignar —</option>
                      {properties.map(p => (
                        <option key={p.id} value={p.id}>{p.attributes?.title || p.id}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={edits[h.id]?.property_id || ""}
                      onChange={e => setEdits(prev => ({ ...prev, [h.id]: { ...prev[h.id], property_id: e.target.value } }))}
                      placeholder="UUID de la propiedad"
                      style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", fontSize: 12, width: "100%", boxSizing: "border-box" }}
                    />
                  )}
                </td>

                {/* Room Type ID */}
                <td style={{ padding: "8px 12px" }}>
                  {roomTypes.length > 0 ? (
                    <select
                      value={edits[h.id]?.room_type_id || ""}
                      onChange={e => setEdits(prev => ({ ...prev, [h.id]: { ...prev[h.id], room_type_id: e.target.value } }))}
                      style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", fontSize: 12, width: "100%" }}>
                      <option value="">— Sin asignar —</option>
                      {roomTypes.map(rt => (
                        <option key={rt.id} value={rt.id}>{rt.attributes?.title || rt.id}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={edits[h.id]?.room_type_id || ""}
                      onChange={e => setEdits(prev => ({ ...prev, [h.id]: { ...prev[h.id], room_type_id: e.target.value } }))}
                      placeholder="UUID del room type"
                      style={{ border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 10px", fontSize: 12, width: "100%", boxSizing: "border-box" }}
                    />
                  )}
                </td>

                <td style={{ padding: "8px 12px" }}>
                  <button onClick={() => guardarMapeo(h.id)} disabled={saving[h.id]}
                    style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                    {saving[h.id] ? "..." : "Guardar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 3: Sync Log
// ─────────────────────────────────────────────────────────────────────────────
function TabSyncLog() {
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const r = await axios.get(`${API}/api/otas/sync-log?limit=100`, { headers: getH() });
      setLogs(r.data || []);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={cargar}
          style={{ background: "#f3f4f6", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
          ↻ Actualizar
        </button>
      </div>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
        {loading ? (
          <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>Cargando...</div>
        ) : logs.length === 0 ? (
          <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
            <div>Sin registros de sincronización aún.</div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["Fecha", "Reserva", "Hab.", "Acción", "Estado", "Detalle"].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l, i) => {
                const ok = l.estado === "ok";
                return (
                  <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "10px 14px", whiteSpace: "nowrap" }}>{fmtTs(l.created_at)}</td>
                    <td style={{ padding: "10px 14px" }}>{l.reserva_id ? `#${l.reserva_id}` : "—"}</td>
                    <td style={{ padding: "10px 14px" }}>Hab. {l.habitacion_numero}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: l.accion === "bloquear" ? "#fee2e2" : "#dcfce7", color: l.accion === "bloquear" ? "#dc2626" : "#166534", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {l.accion === "bloquear" ? "🔒 bloquear" : "🔓 liberar"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ background: ok ? "#dcfce7" : "#fee2e2", color: ok ? "#166534" : "#dc2626", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>
                        {ok ? "✓ ok" : "✗ error"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 11, color: "#6b7280", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {typeof l.response === "string" ? l.response : JSON.stringify(l.response)?.slice(0, 120)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────
export default function OTAs() {
  const [tab, setTab] = useState("reservas");

  const TABS = [
    { id: "reservas",       label: "Reservas OTA" },
    { id: "configuracion",  label: "Configuración" },
    { id: "synclog",        label: "Sync Log" },
  ];

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, color: "#1a1a2e", fontSize: 22 }}>OTAs — Channex</h2>
        <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
          Reservas recibidas desde Booking.com, Airbnb, Expedia y otros canales via Channex
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid #e2e8f0" }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: "none", border: "none", borderBottom: tab === t.id ? "2px solid #1a1a2e" : "2px solid transparent",
              marginBottom: -2, padding: "10px 20px", fontSize: 14, fontWeight: tab === t.id ? 700 : 500,
              color: tab === t.id ? "#1a1a2e" : "#6b7280", cursor: "pointer",
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "reservas"      && <TabReservas />}
      {tab === "configuracion" && <TabConfiguracion />}
      {tab === "synclog"       && <TabSyncLog />}
    </div>
  );
}
