// src/pages/OTAs.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Módulo de gestión de canales OTA
// RF-15: ver reservas recibidas via webhook (Channex → PMS)
// RF-16: bloqueo de disponibilidad en Channex al crear reserva
// RF-17: liberación de disponibilidad al cancelar
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import otasService    from "../services/otasService";
import reservasService from "../services/reservasService";

const CANALES = ["channex", "booking", "airbnb", "expedia", "sandbox"];

const CANAL_INFO = {
  channex:  { label: "Channex",       color: "#2563eb", bg: "#dbeafe" },
  booking:  { label: "Booking.com",   color: "#003580", bg: "#e0eaf8" },
  airbnb:   { label: "Airbnb",        color: "#ff385c", bg: "#ffe4ea" },
  expedia:  { label: "Expedia",       color: "#f5a623", bg: "#fff3dc" },
  sandbox:  { label: "Sandbox",       color: "#6b7280", bg: "#f3f4f6" },
};

const fmt = (d) => d ? dayjs(d).format("DD/MM/YYYY") : "—";
const fmtDt = (d) => d ? dayjs(d).format("DD/MM/YYYY HH:mm") : "—";

const S = {
  page:    { padding: "20px 24px", maxWidth: 1200, margin: "0 auto" },
  card:    { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 16 },
  tab:     (active) => ({
    padding: "8px 20px", border: "none", borderRadius: 20, cursor: "pointer", fontWeight: 600,
    fontSize: 13, marginRight: 8,
    background: active ? "#1a1a2e" : "#f3f4f6",
    color:      active ? "#fff"    : "#374151",
  }),
  badge:   (color, bg) => ({
    background: bg, color, borderRadius: 6, padding: "2px 10px",
    fontSize: 11, fontWeight: 700, display: "inline-block",
  }),
  estadoBadge: (e) => ({
    reservada:  { bg: "#dbeafe", color: "#1d4ed8" },
    ocupada:    { bg: "#dcfce7", color: "#166534" },
    finalizada: { bg: "#f3f4f6", color: "#374151" },
    cancelada:  { bg: "#fee2e2", color: "#dc2626" },
    no_show:    { bg: "#fef3c7", color: "#d97706" },
  }[e] || { bg: "#f3f4f6", color: "#374151" }),
  input:   { border: "1px solid #d1d5db", borderRadius: 8, padding: "7px 12px", fontSize: 14 },
  btn:     (bg = "#1a1a2e") => ({
    background: bg, color: "#fff", border: "none", borderRadius: 8,
    padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer",
  }),
  btnSec:  { background: "#f3f4f6", color: "#374151", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer" },
};

export default function OTAs() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("reservas"); // reservas | config | synclog | sandbox

  // ── Tab Reservas ──────────────────────────────────────────────────────────
  const [reservas, setReservas]     = useState([]);
  const [loadingR, setLoadingR]     = useState(true);
  const [stats,    setStats]        = useState([]);
  const [filtroCanal, setFiltroCanal] = useState("todos");

  // ── Tab Config ────────────────────────────────────────────────────────────
  const [configs,  setConfigs]      = useState({});
  const [loadingC, setLoadingC]     = useState(false);
  const [msgConfig, setMsgConfig]   = useState({});

  // ── Tab Sync Log ──────────────────────────────────────────────────────────
  const [syncLog,  setSyncLog]      = useState([]);
  const [loadingS, setLoadingS]     = useState(false);

  // ── Tab Sandbox ───────────────────────────────────────────────────────────
  const [sbCanal,   setSbCanal]   = useState("sandbox");
  const [sbOtaId,   setSbOtaId]   = useState(`TEST-${Date.now()}`);
  const [sbHab,     setSbHab]     = useState("");
  const [sbDesde,   setSbDesde]   = useState(dayjs().add(1,"day").format("YYYY-MM-DD"));
  const [sbHasta,   setSbHasta]   = useState(dayjs().add(3,"day").format("YYYY-MM-DD"));
  const [sbNombre,  setSbNombre]  = useState("Cliente Prueba OTA");
  const [sbLoading, setSbLoading] = useState(false);
  const [sbMsg,     setSbMsg]     = useState({ text: "", ok: false });

  const [sbCancelOtaId, setSbCancelOtaId] = useState("");
  const [sbCancelCanal, setSbCancelCanal] = useState("sandbox");
  const [sbCancelMsg,   setSbCancelMsg]   = useState({ text: "", ok: false });
  const [sbCancelLoad,  setSbCancelLoad]  = useState(false);

  // ── Cargar reservas OTA ───────────────────────────────────────────────────
  const cargarReservas = useCallback(async () => {
    setLoadingR(true);
    try {
      const { data } = await reservasService.listar({ origen: "ota", limit: 100 });
      const items = Array.isArray(data) ? data : (data.items || []);
      setReservas(items);
    } catch { setReservas([]); }
    finally { setLoadingR(false); }
  }, []);

  const cargarStats = useCallback(async () => {
    try {
      const { data } = await otasService.stats({
        desde: dayjs().subtract(30,"day").format("YYYY-MM-DD"),
        hasta: dayjs().format("YYYY-MM-DD"),
      });
      setStats(data || []);
    } catch { setStats([]); }
  }, []);

  // ── Cargar configs de todos los canales ──────────────────────────────────
  const cargarConfigs = useCallback(async () => {
    setLoadingC(true);
    const result = {};
    await Promise.all(CANALES.map(async (canal) => {
      try {
        const { data } = await otasService.getConfig(canal);
        result[canal] = {
          activa: data.activa,
          habitaciones_incluidas: data.habitaciones_incluidas
            ? JSON.stringify(data.habitaciones_incluidas) : "",
          planes_incluidos: data.planes_incluidos
            ? JSON.stringify(data.planes_incluidos) : "",
        };
      } catch {
        result[canal] = { activa: true, habitaciones_incluidas: "", planes_incluidos: "" };
      }
    }));
    setConfigs(result);
    setLoadingC(false);
  }, []);

  // ── Cargar sync log ───────────────────────────────────────────────────────
  const cargarSyncLog = useCallback(async () => {
    setLoadingS(true);
    try {
      const { data } = await otasService.syncLog({ limit: 50 });
      setSyncLog(data || []);
    } catch { setSyncLog([]); }
    finally { setLoadingS(false); }
  }, []);

  useEffect(() => {
    cargarReservas();
    cargarStats();
  }, [cargarReservas, cargarStats]);

  useEffect(() => {
    if (tab === "config")   cargarConfigs();
    if (tab === "synclog")  cargarSyncLog();
  }, [tab, cargarConfigs, cargarSyncLog]);

  // ── Guardar config canal ──────────────────────────────────────────────────
  const guardarConfig = async (canal) => {
    const cfg = configs[canal];
    let habitaciones_incluidas = null;
    let planes_incluidos = null;
    try {
      if (cfg.habitaciones_incluidas?.trim())
        habitaciones_incluidas = JSON.parse(cfg.habitaciones_incluidas);
      if (cfg.planes_incluidos?.trim())
        planes_incluidos = JSON.parse(cfg.planes_incluidos);
    } catch {
      setMsgConfig(p => ({ ...p, [canal]: { text: "JSON inválido en filtros.", ok: false } }));
      return;
    }
    try {
      await otasService.setConfig(canal, {
        activa: cfg.activa,
        habitaciones_incluidas,
        planes_incluidos,
      });
      setMsgConfig(p => ({ ...p, [canal]: { text: "✓ Configuración guardada.", ok: true } }));
      setTimeout(() => setMsgConfig(p => ({ ...p, [canal]: { text: "", ok: false } })), 2000);
    } catch (e) {
      setMsgConfig(p => ({ ...p, [canal]: { text: e?.response?.data?.message || "Error.", ok: false } }));
    }
  };

  // ── Sandbox: crear reserva de prueba ─────────────────────────────────────
  const sandboxCrear = async () => {
    if (!sbHab || !sbOtaId) return setSbMsg({ text: "Habitación y OTA ID son obligatorios.", ok: false });
    setSbLoading(true); setSbMsg({ text: "", ok: false });
    try {
      const { data } = await otasService.sandboxCrear({
        ota_canal: sbCanal,
        ota_reserva_id: sbOtaId,
        habitacion_numero: sbHab,
        fecha_inicio: sbDesde,
        fecha_fin: sbHasta,
        titular: { nombre: sbNombre, email: "test@ota.com" },
      });
      setSbMsg({ text: `✓ Reserva OTA creada — ID #${data.reserva_id}`, ok: true });
      setSbOtaId(`TEST-${Date.now()}`);
      cargarReservas();
      cargarStats();
    } catch (e) {
      setSbMsg({ text: e?.response?.data?.message || "Error al crear.", ok: false });
    } finally { setSbLoading(false); }
  };

  const sandboxCancelar = async () => {
    if (!sbCancelOtaId) return setSbCancelMsg({ text: "OTA ID obligatorio.", ok: false });
    setSbCancelLoad(true); setSbCancelMsg({ text: "", ok: false });
    try {
      const { data } = await otasService.sandboxCancelar({
        ota_canal: sbCancelCanal,
        ota_reserva_id: sbCancelOtaId,
        motivo: "Cancelación de prueba desde sandbox",
      });
      setSbCancelMsg({ text: data.cancelled ? "✓ Reserva cancelada correctamente." : "OK (no existía).", ok: true });
      cargarReservas();
    } catch (e) {
      setSbCancelMsg({ text: e?.response?.data?.message || "Error.", ok: false });
    } finally { setSbCancelLoad(false); }
  };

  // ── Filtrado reservas ─────────────────────────────────────────────────────
  const reservasFiltradas = filtroCanal === "todos"
    ? reservas
    : reservas.filter(r => r.ota_canal === filtroCanal || r.fuente === filtroCanal);

  const totalOTA = stats.reduce((s, x) => s + (x.total || 0), 0);

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, color: "#1a1a2e" }}>🔗 Canales OTA</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            RF-15 · RF-16 · RF-17 — Integración con Channex / Booking.com / Airbnb
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={S.btnSec} onClick={cargarReservas}>↻ Actualizar</button>
          <button style={S.btn()} onClick={() => navigate("/reservas")}>← Reservas</button>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 20 }}>
        <div style={{ ...S.card, marginBottom: 0, textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#2563eb" }}>{totalOTA}</div>
          <div style={{ fontSize: 11, color: "#6b7280", textTransform: "uppercase", letterSpacing: .5 }}>Reservas OTA (30d)</div>
        </div>
        {stats.map(s => (
          <div key={s.ota_canal} style={{ ...S.card, marginBottom: 0, textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: CANAL_INFO[s.ota_canal]?.color || "#374151" }}>{s.total}</div>
            <div style={S.badge(CANAL_INFO[s.ota_canal]?.color || "#374151", CANAL_INFO[s.ota_canal]?.bg || "#f3f4f6")}>
              {CANAL_INFO[s.ota_canal]?.label || s.ota_canal}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 20 }}>
        {[
          { id: "reservas", label: "📋 Reservas recibidas" },
          { id: "config",   label: "⚙️ Configuración canales" },
          { id: "synclog",  label: "🔄 Log sync RF-16/17" },
          { id: "sandbox",  label: "🧪 Sandbox / Pruebas" },
        ].map(t => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══ TAB RESERVAS ══════════════════════════════════════════════════════ */}
      {tab === "reservas" && (
        <div style={S.card}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#6b7280" }}>Filtrar canal:</span>
            {["todos", ...CANALES].map(c => (
              <button key={c} onClick={() => setFiltroCanal(c)}
                style={{ ...S.tab(filtroCanal === c), marginRight: 4, background: filtroCanal === c ? (CANAL_INFO[c]?.color || "#1a1a2e") : "#f3f4f6", color: filtroCanal === c ? "#fff" : "#374151" }}>
                {c === "todos" ? "Todos" : CANAL_INFO[c]?.label || c}
              </button>
            ))}
          </div>

          {loadingR ? (
            <div style={{ textAlign: "center", padding: 40, color: "#6b7280" }}>Cargando reservas OTA...</div>
          ) : reservasFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
              <div>No hay reservas OTA{filtroCanal !== "todos" ? ` del canal ${filtroCanal}` : ""}.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Usa el tab Sandbox para simular una reserva entrante.</div>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["#", "Canal", "OTA ID", "Habitación", "Check-in", "Check-out", "Huésped", "Estado", "Recibida", ""].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {reservasFiltradas.map((r, i) => {
                    const ci = CANAL_INFO[r.ota_canal || r.fuente] || CANAL_INFO.sandbox;
                    const eb = S.estadoBadge(r.estado);
                    const huesped = r.ota_payload?.customer_name || r.huesped_nombre || "Cliente OTA";
                    return (
                      <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6", background: i%2===0 ? "#fff" : "#fafafa" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600 }}>#{r.id}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={S.badge(ci.color, ci.bg)}>{ci.label}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontFamily: "monospace", fontSize: 11, color: "#6b7280", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.ota_reserva_id || "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontWeight: 500 }}>{r.habitacion_numero || "—"}</td>
                        <td style={{ padding: "10px 12px" }}>{fmt(r.fecha_inicio)}</td>
                        <td style={{ padding: "10px 12px" }}>{fmt(r.fecha_fin)}</td>
                        <td style={{ padding: "10px 12px" }}>{huesped}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ background: eb.bg, color: eb.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                            {r.estado}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 11, color: "#9ca3af" }}>{fmtDt(r.created_at)}</td>
                        <td style={{ padding: "10px 12px" }}>
                          <button style={S.btn("#2563eb")} onClick={() => navigate(`/reservas/${r.id}`)}>
                            Ver
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ TAB CONFIG ════════════════════════════════════════════════════════ */}
      {tab === "config" && (
        <div>
          {loadingC ? (
            <div style={{ textAlign: "center", padding: 40 }}>Cargando configuración...</div>
          ) : CANALES.map(canal => {
            const cfg = configs[canal] || { activa: true, habitaciones_incluidas: "", planes_incluidos: "" };
            const ci  = CANAL_INFO[canal] || { label: canal, color: "#374151", bg: "#f3f4f6" };
            const msg = msgConfig[canal];
            return (
              <div key={canal} style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={S.badge(ci.color, ci.bg)}>{ci.label}</span>
                    <span style={{ fontSize: 13, color: "#6b7280" }}>
                      {canal === "channex" ? "Channel Manager principal — recibe webhooks de Booking.com y Airbnb" :
                       canal === "sandbox" ? "Canal de prueba — no requiere integración real" :
                       `Canal OTA — integración via ${canal}`}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: cfg.activa ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
                      {cfg.activa ? "● Activo" : "○ Pausado"}
                    </span>
                    <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <input type="checkbox" checked={cfg.activa}
                        onChange={e => setConfigs(p => ({ ...p, [canal]: { ...p[canal], activa: e.target.checked } }))} />
                      <span style={{ fontSize: 12 }}>Habilitar</span>
                    </label>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
                      HABITACIONES INCLUIDAS (JSON array, vacío = todas)
                    </label>
                    <input style={{ ...S.input, width: "100%", boxSizing: "border-box" }}
                      placeholder='Ej: ["101","102","103"]'
                      value={cfg.habitaciones_incluidas}
                      onChange={e => setConfigs(p => ({ ...p, [canal]: { ...p[canal], habitaciones_incluidas: e.target.value } }))} />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>
                      PLANES INCLUIDOS (JSON array, vacío = todos)
                    </label>
                    <input style={{ ...S.input, width: "100%", boxSizing: "border-box" }}
                      placeholder='Ej: ["C1","C2"]'
                      value={cfg.planes_incluidos}
                      onChange={e => setConfigs(p => ({ ...p, [canal]: { ...p[canal], planes_incluidos: e.target.value } }))} />
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button style={S.btn(ci.color)} onClick={() => guardarConfig(canal)}>Guardar</button>
                  {msg?.text && (
                    <span style={{ fontSize: 13, fontWeight: 500, color: msg.ok ? "#16a34a" : "#dc2626" }}>
                      {msg.text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══ TAB SYNC LOG ══════════════════════════════════════════════════════ */}
      {tab === "synclog" && (
        <div style={S.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>Log de sincronizaciones RF-16 / RF-17</div>
              <div style={{ fontSize: 12, color: "#6b7280" }}>
                Cada vez que el PMS notifica a Channex sobre cambios de disponibilidad queda registrado aquí.
              </div>
            </div>
            <button style={S.btnSec} onClick={cargarSyncLog}>↻</button>
          </div>

          {/* Explicación visual del flujo */}
          <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#166534", marginBottom: 6 }}>FLUJO RF-16 / RF-17</div>
            <div style={{ fontSize: 12, color: "#374151", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ background: "#dcfce7", padding: "2px 8px", borderRadius: 4 }}>PMS crea/confirma reserva</span>
              <span>→</span>
              <span style={{ background: "#dbeafe", padding: "2px 8px", borderRadius: 4 }}>channexBloquearDisponibilidad()</span>
              <span>→</span>
              <span style={{ background: "#ede9fe", padding: "2px 8px", borderRadius: 4 }}>POST /restrictions a Channex API</span>
              <span>→</span>
              <span style={{ background: "#fef3c7", padding: "2px 8px", borderRadius: 4 }}>Channex cierra cupo en Booking/Airbnb</span>
            </div>
            <div style={{ fontSize: 12, color: "#374151", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
              <span style={{ background: "#fee2e2", padding: "2px 8px", borderRadius: 4 }}>PMS cancela reserva</span>
              <span>→</span>
              <span style={{ background: "#dbeafe", padding: "2px 8px", borderRadius: 4 }}>channexLiberarDisponibilidad()</span>
              <span>→</span>
              <span style={{ background: "#ede9fe", padding: "2px 8px", borderRadius: 4 }}>POST /restrictions availability=1</span>
              <span>→</span>
              <span style={{ background: "#fef3c7", padding: "2px 8px", borderRadius: 4 }}>Channex reabre cupo en OTAs</span>
            </div>
          </div>

          {loadingS ? (
            <div style={{ textAlign: "center", padding: 30 }}>Cargando log...</div>
          ) : syncLog.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📋</div>
              <div>Sin registros de sincronización aún.</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Cuando el PMS sincronice con Channex (al crear o cancelar reservas), los eventos aparecerán aquí.
              </div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {["Reserva", "Habitación", "Acción", "Estado", "Respuesta Channex", "Fecha"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syncLog.map(log => (
                  <tr key={log.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 12px" }}>
                      {log.reserva_id ? <button style={{ ...S.btn("#2563eb"), padding: "3px 10px", fontSize: 12 }} onClick={() => navigate(`/reservas/${log.reserva_id}`)}>#{log.reserva_id}</button> : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: 500 }}>Hab. {log.habitacion_numero}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{
                        background: log.accion === "bloquear" ? "#fef3c7" : log.accion === "liberar" ? "#dcfce7" : "#dbeafe",
                        color:      log.accion === "bloquear" ? "#d97706" : log.accion === "liberar" ? "#166534" : "#1d4ed8",
                        borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600,
                      }}>
                        {log.accion === "bloquear" ? "🔒 RF-16 Bloquear" : log.accion === "liberar" ? "🔓 RF-17 Liberar" : log.accion}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <span style={{ background: log.estado === "ok" ? "#dcfce7" : "#fee2e2", color: log.estado === "ok" ? "#166534" : "#dc2626", borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                        {log.estado === "ok" ? "✓ OK" : "✗ Error"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {log.response ? JSON.stringify(log.response).substring(0, 80) + "..." : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 11, color: "#9ca3af" }}>{fmtDt(log.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ══ TAB SANDBOX ═══════════════════════════════════════════════════════ */}
      {tab === "sandbox" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>

          {/* Crear reserva de prueba */}
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>🧪 Simular reserva entrante (RF-15)</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
              Simula una reserva que Channex enviaría via webhook. Usa el canal sandbox para pruebas sin afectar datos reales.
            </div>

            {[
              { label: "Canal OTA", node: <select style={S.input} value={sbCanal} onChange={e => setSbCanal(e.target.value)}>{CANALES.map(c => <option key={c} value={c}>{CANAL_INFO[c]?.label || c}</option>)}</select> },
              { label: "OTA Reserva ID (único)", node: <input style={S.input} value={sbOtaId} onChange={e => setSbOtaId(e.target.value)} /> },
              { label: "Número de habitación", node: <input style={S.input} placeholder="Ej: 101" value={sbHab} onChange={e => setSbHab(e.target.value)} /> },
              { label: "Nombre del huésped", node: <input style={S.input} value={sbNombre} onChange={e => setSbNombre(e.target.value)} /> },
              { label: "Check-in", node: <input type="date" style={S.input} value={sbDesde} onChange={e => setSbDesde(e.target.value)} /> },
              { label: "Check-out", node: <input type="date" style={S.input} value={sbHasta} onChange={e => setSbHasta(e.target.value)} /> },
            ].map(({ label, node }) => (
              <div key={label} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase" }}>{label}</label>
                {node}
              </div>
            ))}

            <button style={{ ...S.btn("#16a34a"), width: "100%", marginTop: 4, opacity: sbLoading ? 0.7 : 1 }}
              onClick={sandboxCrear} disabled={sbLoading}>
              {sbLoading ? "Creando..." : "Enviar reserva OTA de prueba"}
            </button>
            {sbMsg.text && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                background: sbMsg.ok ? "#f0fdf4" : "#fef2f2",
                color:      sbMsg.ok ? "#16a34a" : "#dc2626",
                border: `1px solid ${sbMsg.ok ? "#86efac" : "#fca5a5"}` }}>
                {sbMsg.text}
              </div>
            )}
          </div>

          {/* Cancelar reserva */}
          <div style={S.card}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>❌ Cancelar reserva OTA (RF-17)</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 16 }}>
              Simula la cancelación de una reserva desde la OTA. El PMS cancela la reserva y libera la disponibilidad en Channex.
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase" }}>Canal OTA</label>
              <select style={S.input} value={sbCancelCanal} onChange={e => setSbCancelCanal(e.target.value)}>
                {CANALES.map(c => <option key={c} value={c}>{CANAL_INFO[c]?.label || c}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4, textTransform: "uppercase" }}>OTA Reserva ID</label>
              <input style={S.input} placeholder="ID usado al crear la reserva"
                value={sbCancelOtaId} onChange={e => setSbCancelOtaId(e.target.value)} />
            </div>

            <button style={{ ...S.btn("#dc2626"), width: "100%", opacity: sbCancelLoad ? 0.7 : 1 }}
              onClick={sandboxCancelar} disabled={sbCancelLoad}>
              {sbCancelLoad ? "Cancelando..." : "Cancelar reserva OTA"}
            </button>
            {sbCancelMsg.text && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                background: sbCancelMsg.ok ? "#f0fdf4" : "#fef2f2",
                color:      sbCancelMsg.ok ? "#16a34a" : "#dc2626",
                border: `1px solid ${sbCancelMsg.ok ? "#86efac" : "#fca5a5"}` }}>
                {sbCancelMsg.text}
              </div>
            )}

            <div style={{ marginTop: 20, background: "#f8fafc", borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>WEBHOOK ENDPOINT (RF-15)</div>
              <code style={{ fontSize: 11, background: "#1a1a2e", color: "#86efac", padding: "6px 10px", borderRadius: 6, display: "block" }}>
                POST http://localhost:4000/api/otas/channex/webhook
              </code>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>
                Channex llama este endpoint cuando llega una reserva de Booking.com / Airbnb.
                El servidor responde 200 inmediatamente y procesa en segundo plano.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}