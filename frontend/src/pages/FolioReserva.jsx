// src/pages/FolioReserva.jsx
// Estado de cuenta: cargos, pagos, depósitos, registro de nuevos pagos, saldo en tiempo real
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import dayjs from "dayjs";
import reservasService from "../services/reservasService";
import pagosService from "../services/pagosService";

const money = (v) =>
  Number(v || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtF = (f) => (f ? dayjs(f).format("DD/MM/YYYY HH:mm") : "—");

const METODOS = ["efectivo", "transferencia", "tarjeta", "nequi", "daviplata", "otro"];
const METODO_LABEL = { efectivo:"Efectivo", transferencia:"Transferencia", tarjeta:"Tarjeta", nequi:"Nequi", daviplata:"Daviplata", otro:"Otro" };

// ── Colores por tipo de movimiento ──────────────────────────────────────────
const TC = {
  cargo:    { bg:"#fef2f2", border:"#fca5a5", text:"#991b1b",  label:"Cargo"    },
  pago:     { bg:"#f0fdf4", border:"#86efac", text:"#166534",  label:"Pago"     },
  deposito: { bg:"#eff6ff", border:"#93c5fd", text:"#1d4ed8",  label:"Depósito" },
};

// ── Estilos ─────────────────────────────────────────────────────────────────
const S = {
  card:    { background:"#fff", border:"1px solid #e5e7eb", borderRadius:10, padding:20, marginBottom:16 },
  label:   { fontSize:11, color:"#6b7280", display:"block", marginBottom:4, fontWeight:600, textTransform:"uppercase", letterSpacing:.5 },
  input:   { border:"1px solid #d1d5db", borderRadius:8, padding:"7px 12px", fontSize:14, width:"100%", outline:"none" },
  btnPrim: { background:"#1a1a2e", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontWeight:600, fontSize:13, cursor:"pointer" },
  btnGreen:{ background:"#16a34a", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontWeight:600, fontSize:13, cursor:"pointer" },
  btnBlue: { background:"#2563eb", color:"#fff", border:"none", borderRadius:8, padding:"9px 20px", fontWeight:600, fontSize:13, cursor:"pointer" },
  btnSec:  { background:"#f3f4f6", color:"#374151", border:"1px solid #e5e7eb", borderRadius:8, padding:"9px 20px", fontWeight:600, fontSize:13, cursor:"pointer" },
  th:      { padding:"8px 12px", textAlign:"left", fontSize:11, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:.5, borderBottom:"2px solid #e5e7eb" },
  td:      { padding:"10px 12px", fontSize:13, borderBottom:"1px solid #f3f4f6" },
};

// ── Componentes simples ──────────────────────────────────────────────────────
function CardSection({ title, children }) {
  return (
    <div style={S.card}>
      <div style={{ fontSize:12, fontWeight:700, color:"#6b7280", letterSpacing:1, marginBottom:14, textTransform:"uppercase" }}>{title}</div>
      {children}
    </div>
  );
}

function KPI({ label, value, color="#1a1a2e" }) {
  return (
    <div style={{ background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:8, padding:"12px 16px" }}>
      <div style={{ fontSize:10, color:"#9ca3af", textTransform:"uppercase", letterSpacing:.8, marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:20, fontWeight:700, color }}>{value}</div>
    </div>
  );
}

function Badge({ tipo }) {
  const t = TC[tipo] || TC.cargo;
  return (
    <span style={{ background:t.bg, color:t.text, border:`1px solid ${t.border}`, borderRadius:6, padding:"2px 8px", fontSize:11, fontWeight:600 }}>
      {t.label}
    </span>
  );
}

function Alerta({ msg, ok }) {
  if (!msg) return null;
  return (
    <div style={{ marginTop:8, padding:"8px 12px", borderRadius:6, fontSize:13, fontWeight:500,
      background: ok ? "#f0fdf4" : "#fef2f2",
      color:      ok ? "#15803d" : "#dc2626",
      border:     `1px solid ${ok ? "#86efac" : "#fca5a5"}` }}>
      {msg}
    </div>
  );
}

// ── Formulario de pago/depósito ──────────────────────────────────────────────
function FormPago({ reservaId, tipo, estadoReserva, onExito }) {
  const [monto,    setMonto]    = useState("");
  const [metodo,   setMetodo]   = useState("efectivo");
  const [ref,      setRef]      = useState("");
  const [saving,   setSaving]   = useState(false);
  const [msg,      setMsg]      = useState({ text:"", ok:false });

  // Regla de negocio: depósito solo en 'reservada', pago solo en 'ocupada'
  const permitido = tipo === "deposito"
    ? estadoReserva === "reservada"
    : estadoReserva === "ocupada";

  if (!permitido) {
    const txt = tipo === "deposito"
      ? "Los depósitos solo aplican cuando la reserva está en estado 'reservada'."
      : "Los pagos solo aplican cuando la reserva está 'ocupada' (huésped con check-in).";
    return <div style={{ color:"#6b7280", fontSize:13, padding:"8px 0" }}>{txt}</div>;
  }

  const enviar = async () => {
    setMsg({ text:"", ok:false });
    const m = Number(monto);
    if (!m || m <= 0) return setMsg({ text:"El monto debe ser mayor a 0.", ok:false });
    setSaving(true);
    try {
      await pagosService.registrar({ reserva_id: reservaId, tipo, metodo, monto: m, referencia: ref.trim() || null });
      setMsg({ text:`✓ ${tipo === "deposito" ? "Depósito" : "Pago"} registrado.`, ok:true });
      setMonto(""); setRef("");
      setTimeout(() => { setMsg({ text:"", ok:false }); onExito(); }, 1200);
    } catch(e) {
      setMsg({ text: e?.response?.data?.message || "Error al registrar.", ok:false });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
        <div style={{ flex:"1 1 140px" }}>
          <label style={S.label}>Monto (COP) *</label>
          <input type="number" min="1" placeholder="Ej: 150000"
            value={monto} onChange={e => setMonto(e.target.value)}
            style={S.input} />
        </div>
        <div style={{ flex:"1 1 160px" }}>
          <label style={S.label}>Método de pago *</label>
          <select value={metodo} onChange={e => setMetodo(e.target.value)}
            style={{ ...S.input, cursor:"pointer" }}>
            {METODOS.map(m => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
          </select>
        </div>
        <div style={{ flex:"2 1 200px" }}>
          <label style={S.label}>Referencia / observación</label>
          <input type="text" placeholder="Nro. transacción, recibo, etc."
            value={ref} onChange={e => setRef(e.target.value)}
            style={S.input} />
        </div>
      </div>
      <div>
        <button onClick={enviar} disabled={saving || !monto}
          style={{ ...(tipo === "deposito" ? S.btnBlue : S.btnGreen), opacity: saving ? .7 : 1 }}>
          {saving ? "Guardando..." : tipo === "deposito" ? "Registrar depósito" : "Registrar pago"}
        </button>
      </div>
      <Alerta msg={msg.text} ok={msg.ok} />
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function FolioReserva() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const [datos,    setDatos]    = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState("");
  // Cargo manual
  const [cMonto,   setCMonto]   = useState("");
  const [cDesc,    setCDesc]    = useState("");
  const [cSaving,  setCSaving]  = useState(false);
  const [cMsg,     setCMsg]     = useState({ text:"", ok:false });
  // Panel activo
  const [panel,    setPanel]    = useState(null); // null | "deposito" | "pago"

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await reservasService.obtenerFinanzas(id);
      setDatos(data);
    } catch(e) {
      setError(e?.response?.data?.message || "No se pudo cargar el folio.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const agregarCargo = async () => {
    setCMsg({ text:"", ok:false });
    const m = Number(cMonto);
    if (!m || m <= 0) return setCMsg({ text:"El monto debe ser mayor a 0.", ok:false });
    if (!cDesc.trim()) return setCMsg({ text:"La descripción es obligatoria.", ok:false });
    setCSaving(true);
    try {
      await reservasService.agregarCargo(id, { monto: m, metodo:"otro", tipo:"cargo", referencia: cDesc.trim() });
      setCMonto(""); setCDesc("");
      setCMsg({ text:"✓ Cargo registrado.", ok:true });
      setTimeout(() => { setCMsg({ text:"", ok:false }); cargar(); }, 1000);
    } catch(e) {
      setCMsg({ text: e?.response?.data?.message || "Error al registrar el cargo.", ok:false });
    } finally { setCSaving(false); }
  };

  if (loading) return (
    <div style={{ textAlign:"center", padding:60, color:"#6b7280", fontFamily:"system-ui" }}>
      Cargando folio...
    </div>
  );
  if (error) return (
    <div style={{ maxWidth:700, margin:"40px auto", padding:24, fontFamily:"system-ui" }}>
      <div style={{ background:"#fef2f2", border:"1px solid #fca5a5", borderRadius:8, padding:20, color:"#991b1b", marginBottom:12 }}>{error}</div>
      <button onClick={() => navigate(-1)} style={S.btnSec}>Volver</button>
    </div>
  );
  if (!datos) return null;

  const { reserva, movimientos = [], resumen = {}, huespedes_asociados = [], factura } = datos;
  const cargos  = movimientos.filter(m => m.tipo === "cargo");
  const pagosYd = movimientos.filter(m => m.tipo === "pago" || m.tipo === "deposito");
  const noches  = dayjs(reserva.fecha_fin).diff(dayjs(reserva.fecha_inicio), "day");
  const saldo   = Number(resumen.saldo || 0);
  const puedeDeposito = reserva.estado === "reservada";
  const puedePago     = reserva.estado === "ocupada";

  return (
    <div style={{ maxWidth:980, margin:"0 auto", padding:"24px 16px", fontFamily:"system-ui, sans-serif" }}>

      {/* ── Cabecera ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <h3 style={{ margin:0, fontWeight:800, color:"#1a1a2e", fontSize:20 }}>
            Folio — Reserva #{reserva.id}
          </h3>
          <div style={{ color:"#6b7280", fontSize:13, marginTop:3 }}>
            Registro completo de cargos, pagos y depósitos.
          </div>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {reserva.estado === "ocupada" && (
            <button onClick={() => navigate(`/facturacion/${id}`)} style={S.btnGreen}>
              Check-out / Facturar
            </button>
          )}
          <button onClick={() => navigate(`/registro/${id}`)} style={S.btnPrim}>
            Ver registro
          </button>
          <button onClick={() => navigate(-1)} style={S.btnSec}>Volver</button>
        </div>
      </div>

      {/* ── Info reserva ── */}
      <CardSection title="Resumen de la reserva">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))", gap:"6px 32px" }}>
          {[
            ["Habitación",   `${reserva.habitacion_numero || ""} — ${reserva.habitacion_tipo || ""}`],
            ["Huésped",      reserva.huesped_nombre || "—"],
            ["Check-in",     dayjs(reserva.fecha_inicio).format("DD/MM/YYYY")],
            ["Check-out",    dayjs(reserva.fecha_fin).format("DD/MM/YYYY")],
            ["Noches",       noches],
            ["Plan",         reserva.plan || "—"],
            ["Estado",       reserva.estado],
            ["Fuente",       reserva.fuente || "—"],
          ].map(([l, v]) => (
            <div key={l} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom:"1px solid #f3f4f6", fontSize:13 }}>
              <span style={{ color:"#6b7280" }}>{l}</span>
              <span style={{ fontWeight:600, color:"#1a1a2e" }}>{v}</span>
            </div>
          ))}
        </div>
      </CardSection>

      {/* ── Resumen financiero ── */}
      <div style={{ background:"#1a1a2e", borderRadius:10, padding:20, marginBottom:16, color:"#fff" }}>
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:1.2, marginBottom:14, color:"#94a3b8", textTransform:"uppercase" }}>
          Resumen financiero
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:12 }}>
          <KPI label="Total facturado" value={money(resumen.total_facturado)} color="#fff"     />
          <KPI label="Depósitos"       value={money(resumen.total_depositos)} color="#93c5fd"  />
          <KPI label="Pagos"           value={money(resumen.total_pagos)}     color="#86efac"  />
          <KPI label="Cargos extras"   value={money(resumen.total_cargos)}    color="#fca5a5"  />
          <KPI label="Saldo pendiente" value={money(saldo)}
            color={saldo > 0 ? "#f87171" : saldo < 0 ? "#fbbf24" : "#4ade80"} />
        </div>
        {saldo < 0 && (
          <div style={{ marginTop:10, fontSize:12, color:"#fbbf24" }}>
            ⚠ Saldo negativo: hay un exceso de pagos de {money(Math.abs(saldo))}. Verificar si corresponde a un reembolso.
          </div>
        )}
        {factura && (
          <div style={{ marginTop:10, fontSize:12, color:"#94a3b8" }}>
            Factura #{factura.numero} — {factura.estado} — emitida {fmtF(factura.fecha_emision)}
          </div>
        )}
      </div>

      {/* ── ACCIONES DE PAGO ── */}
      {(puedeDeposito || puedePago) && (
        <CardSection title="Registrar pago / depósito">
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {puedeDeposito && (
              <button
                onClick={() => setPanel(p => p === "deposito" ? null : "deposito")}
                style={{ ...(panel === "deposito" ? S.btnBlue : S.btnSec), fontSize:13 }}>
                {panel === "deposito" ? "✕ Cancelar" : "Registrar depósito"}
              </button>
            )}
            {puedePago && (
              <button
                onClick={() => setPanel(p => p === "pago" ? null : "pago")}
                style={{ ...(panel === "pago" ? S.btnGreen : S.btnSec), fontSize:13 }}>
                {panel === "pago" ? "✕ Cancelar" : "Registrar pago"}
              </button>
            )}
          </div>
          {panel === "deposito" && (
            <div style={{ background:"#eff6ff", border:"1px solid #93c5fd", borderRadius:8, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#1d4ed8", marginBottom:12 }}>
                Depósito de garantía — reserva en estado "reservada"
              </div>
              <FormPago reservaId={Number(id)} tipo="deposito" estadoReserva={reserva.estado}
                onExito={() => { setPanel(null); cargar(); }} />
            </div>
          )}
          {panel === "pago" && (
            <div style={{ background:"#f0fdf4", border:"1px solid #86efac", borderRadius:8, padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#15803d", marginBottom:12 }}>
                Pago durante estadía — reserva "ocupada"
              </div>
              <FormPago reservaId={Number(id)} tipo="pago" estadoReserva={reserva.estado}
                onExito={() => { setPanel(null); cargar(); }} />
            </div>
          )}
        </CardSection>
      )}

      {/* ── Cargos ── */}
      <CardSection title={`Cargos (${cargos.length})`}>
        {cargos.length === 0 ? (
          <div style={{ color:"#9ca3af", fontSize:13 }}>Sin cargos adicionales.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={S.th}>Fecha</th>
                  <th style={S.th}>Descripción</th>
                  <th style={S.th}>Método</th>
                  <th style={{ ...S.th, textAlign:"right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map(c => (
                  <tr key={c.id}>
                    <td style={S.td}>{fmtF(c.fecha || c.created_at)}</td>
                    <td style={S.td}>{c.referencia || c.descripcion || "—"}</td>
                    <td style={S.td}>{METODO_LABEL[c.metodo] || c.metodo || "—"}</td>
                    <td style={{ ...S.td, textAlign:"right", fontWeight:600, color:"#dc2626" }}>{money(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Agregar cargo manual */}
        {(reserva.estado === "ocupada" || reserva.estado === "reservada") && (
          <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid #f3f4f6" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#6b7280", textTransform:"uppercase", letterSpacing:.5, marginBottom:10 }}>
              Agregar cargo manual
            </div>
            <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"flex-end" }}>
              <div style={{ flex:"1 1 130px" }}>
                <label style={S.label}>Monto (COP)</label>
                <input type="number" min={1} value={cMonto} placeholder="15000"
                  onChange={e => setCMonto(e.target.value)} style={S.input} />
              </div>
              <div style={{ flex:"3 1 240px" }}>
                <label style={S.label}>Descripción *</label>
                <input type="text" value={cDesc} placeholder="Minibar, lavandería, restaurante..."
                  onChange={e => setCDesc(e.target.value)} style={S.input} />
              </div>
              <button onClick={agregarCargo} disabled={cSaving || !cMonto || !cDesc}
                style={{ ...S.btnPrim, opacity: cSaving ? .7 : 1, whiteSpace:"nowrap" }}>
                {cSaving ? "Guardando..." : "+ Agregar cargo"}
              </button>
            </div>
            <Alerta msg={cMsg.text} ok={cMsg.ok} />
          </div>
        )}
      </CardSection>

      {/* ── Pagos y depósitos ── */}
      <CardSection title={`Pagos y depósitos (${pagosYd.length})`}>
        {pagosYd.length === 0 ? (
          <div style={{ color:"#9ca3af", fontSize:13 }}>Sin pagos ni depósitos registrados.</div>
        ) : (
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  <th style={S.th}>Fecha</th>
                  <th style={S.th}>Tipo</th>
                  <th style={S.th}>Método</th>
                  <th style={S.th}>Referencia</th>
                  <th style={{ ...S.th, textAlign:"right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {pagosYd.map(p => (
                  <tr key={p.id}>
                    <td style={S.td}>{fmtF(p.fecha || p.created_at)}</td>
                    <td style={S.td}><Badge tipo={p.tipo} /></td>
                    <td style={S.td}>{METODO_LABEL[p.metodo] || p.metodo || "—"}</td>
                    <td style={S.td}>{p.referencia || "—"}</td>
                    <td style={{ ...S.td, textAlign:"right", fontWeight:600, color:"#16a34a" }}>{money(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background:"#f8fafc" }}>
                  <td colSpan={4} style={{ ...S.td, fontWeight:700, color:"#1a1a2e" }}>Total recibido</td>
                  <td style={{ ...S.td, textAlign:"right", fontWeight:700, color:"#16a34a", fontSize:15 }}>
                    {money(pagosYd.reduce((s, p) => s + Number(p.monto), 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </CardSection>

      {/* ── Huéspedes asociados ── */}
      {huespedes_asociados.length > 0 && (
        <CardSection title={`Huéspedes asociados (${huespedes_asociados.length})`}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:10 }}>
            {huespedes_asociados.map(h => (
              <div key={h.id} style={{ background:"#f8fafc", border:"1px solid #e5e7eb", borderRadius:8, padding:"10px 14px", fontSize:13 }}>
                <div style={{ fontWeight:600 }}>{h.nombre_completo || h.nombre}</div>
                <div style={{ color:"#6b7280", fontSize:12 }}>{h.tipo_documento} {h.documento}</div>
              </div>
            ))}
          </div>
        </CardSection>
      )}

      {/* ── Botones finales ── */}
      <div style={{ display:"flex", gap:10, marginTop:8, flexWrap:"wrap" }}>
        {reserva.estado === "ocupada" && (
          <button onClick={() => navigate(`/facturacion/${id}`)} style={S.btnGreen}>
            Ir a check-out / facturar
          </button>
        )}
        <button onClick={() => navigate(`/registro/${id}`)} style={S.btnPrim}>
          Ver registro hotelero
        </button>
        <button onClick={() => navigate(-1)} style={S.btnSec}>Volver</button>
      </div>
    </div>
  );
}