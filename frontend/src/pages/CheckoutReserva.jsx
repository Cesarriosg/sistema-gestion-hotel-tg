// src/pages/CheckoutReserva.jsx
// Check-out: ver cargos, registrar pago final, generar factura y confirmar check-out.
// Regla: debe haber al menos un pago y saldo = 0 para facturar y hacer checkout.

import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import axios from "axios";
import reservasService from "../services/reservasService";
import pagosService from "../services/pagosService";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const money = (v) =>
  Number(v || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const fmtF = (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "—");

const METODOS = ["efectivo", "transferencia", "tarjeta", "nequi", "daviplata"];
const METODO_LABEL = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta", nequi: "Nequi", daviplata: "Daviplata" };

const C = {
  navy: "#1a1a2e", blue: "#2563eb", green: "#16a34a",
  red: "#dc2626", amber: "#d97706", gray: "#6b7280",
  border: "#e2e8f0", white: "#ffffff", light: "#f8fafc",
};

const S = {
  card:    { background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 24, marginBottom: 16 },
  label:   { fontSize: 11, color: C.gray, display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 },
  input:   { border: `1px solid ${C.border}`, borderRadius: 8, padding: "8px 12px", fontSize: 14, width: "100%", outline: "none" },
  btnPrim: { background: C.navy, color: C.white, border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  btnGreen:{ background: C.green, color: C.white, border: "none", borderRadius: 8, padding: "10px 22px", fontWeight: 700, fontSize: 14, cursor: "pointer" },
  btnSec:  { background: C.light, color: C.navy, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 22px", fontWeight: 600, fontSize: 14, cursor: "pointer" },
  th:      { padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: .5, borderBottom: `2px solid ${C.border}` },
  td:      { padding: "10px 12px", fontSize: 13, borderBottom: `1px solid #f3f4f6` },
};

function Alerta({ msg, ok }) {
  if (!msg) return null;
  return (
    <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 500,
      background: ok ? "#f0fdf4" : "#fef2f2", color: ok ? "#15803d" : "#dc2626",
      border: `1px solid ${ok ? "#86efac" : "#fca5a5"}` }}>
      {msg}
    </div>
  );
}

export default function CheckoutReserva() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [datos,   setDatos]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  // Formulario pago
  const [pMonto,   setPMonto]   = useState("");
  const [pMetodo,  setPMetodo]  = useState("efectivo");
  const [pRef,     setPRef]     = useState("");
  const [pSaving,  setPSaving]  = useState(false);
  const [pMsg,     setPMsg]     = useState({ text: "", ok: false });

  // Facturar
  const [factSaving, setFactSaving] = useState(false);
  const [factMsg,    setFactMsg]    = useState({ text: "", ok: false });

  // Checkout
  const [coSaving, setCoSaving] = useState(false);
  const [coMsg,    setCoMsg]    = useState({ text: "", ok: false });

  // Eliminar pago
  const [deletingId, setDeletingId] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await reservasService.obtenerFinanzas(id);
      setDatos(data);
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudo cargar la reserva.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { cargar(); }, [cargar]);

  const eliminarPago = async (pagoId) => {
    if (!window.confirm("¿Eliminar este pago? Esta acción no se puede deshacer.")) return;
    setDeletingId(pagoId);
    try {
      await axios.delete(`${API}/api/reservas/${id}/pagos/${pagoId}`, { headers: getAuthHeaders() });
      await cargar();
    } catch (e) {
      alert(e?.response?.data?.message || "No se pudo eliminar el pago.");
    } finally {
      setDeletingId(null);
    }
  };

  const registrarPago = async () => {
    setPMsg({ text: "", ok: false });
    const m = Number(pMonto);
    if (!m || m <= 0) return setPMsg({ text: "El monto debe ser mayor a 0.", ok: false });
    if (saldo > 0 && m > saldo) return setPMsg({ text: `El monto ($${m.toLocaleString("es-CO")}) supera el saldo pendiente ($${saldo.toLocaleString("es-CO")}).`, ok: false });
    setPSaving(true);
    try {
      await pagosService.registrar({ reserva_id: Number(id), tipo: "pago", metodo: pMetodo, monto: m, referencia: pRef.trim() || null });
      setPMonto(""); setPRef("");
      setPMsg({ text: "✓ Pago registrado.", ok: true });
      await cargar();
      setTimeout(() => setPMsg({ text: "", ok: false }), 2000);
    } catch (e) {
      setPMsg({ text: e?.response?.data?.message || "Error al registrar pago.", ok: false });
    } finally { setPSaving(false); }
  };

  const generarFactura = async () => {
    setFactMsg({ text: "", ok: false });
    setFactSaving(true);
    try {
      await reservasService.facturar(id, {});
      setFactMsg({ text: "✓ Factura generada correctamente.", ok: true });
      await cargar();
    } catch (e) {
      setFactMsg({ text: e?.response?.data?.message || "Error al generar factura.", ok: false });
    } finally { setFactSaving(false); }
  };

  const confirmarCheckout = async () => {
    setCoMsg({ text: "", ok: false });
    setCoSaving(true);
    try {
      await reservasService.checkout(id, {});
      setCoMsg({ text: "✓ Check-out realizado. La habitación queda disponible.", ok: true });
      await cargar();
    } catch (e) {
      setCoMsg({ text: e?.response?.data?.message || "Error al hacer check-out.", ok: false });
    } finally { setCoSaving(false); }
  };

  if (loading) return <div style={{ textAlign: "center", padding: 60, color: C.gray }}>Cargando...</div>;
  if (error)   return (
    <div style={{ maxWidth: 700, margin: "40px auto", padding: 24 }}>
      <div style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: 20, color: C.red, marginBottom: 12 }}>{error}</div>
      <button onClick={() => navigate(-1)} style={S.btnSec}>Volver</button>
    </div>
  );
  if (!datos) return null;

  const { reserva, movimientos = [], resumen = {}, factura } = datos;
  const cargos  = movimientos.filter(m => m.tipo === "cargo");
  const pagosYd = movimientos.filter(m => m.tipo === "pago" || m.tipo === "deposito");
  const saldo   = Number(resumen.saldo || 0);
  const noches  = dayjs(reserva.fecha_fin).diff(dayjs(reserva.fecha_inicio), "day");

  const puedeFacturar = !factura && Math.abs(saldo) < 1 && pagosYd.length > 0 && reserva.estado === "ocupada";
  const puedeCheckout = !!factura && reserva.estado === "ocupada";
  const yaFinalizada  = reserva.estado === "finalizada";

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>

      {/* ── Encabezado ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.navy }}>
            Check-out / Facturar — Reserva #{id}
          </h2>
          <div style={{ color: C.gray, fontSize: 13, marginTop: 3 }}>
            Hab. {reserva.habitacion_numero} — {reserva.huesped_nombre || "—"} — {noches} noche{noches !== 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => navigate(`/folio/${id}`)} style={S.btnSec}>Ver folio completo</button>
          <button onClick={() => navigate(`/registro/${id}`)} style={S.btnSec}>Ver registro</button>
          <button onClick={() => navigate(-1)} style={S.btnSec}>Volver</button>
        </div>
      </div>

      {/* ── Si ya finalizó ── */}
      {yaFinalizada && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 12, padding: 24, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
          <div style={{ fontWeight: 700, fontSize: 18, color: C.green }}>Check-out completado</div>
          <div style={{ color: C.gray, fontSize: 13, marginTop: 6 }}>
            Esta reserva fue finalizada. {fmtF(reserva.fecha_fin)}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 16 }}>
            <button onClick={() => navigate("/rack")} style={S.btnGreen}>Ir al Rack</button>
            <button onClick={() => navigate("/facturacion")} style={S.btnSec}>Ver facturas</button>
          </div>
        </div>
      )}

      {/* ── Resumen financiero ── */}
      <div style={{ background: C.navy, borderRadius: 12, padding: 20, marginBottom: 16, color: C.white }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, marginBottom: 14, color: "#94a3b8", textTransform: "uppercase" }}>
          Resumen financiero
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 12 }}>
          {[
            ["Total alojamiento", money(resumen.total_facturado), "#fff"],
            ["Cargos extras",     money(resumen.total_cargos),    "#fca5a5"],
            ["Depósitos",         money(resumen.total_depositos), "#93c5fd"],
            ["Pagos recibidos",   money(resumen.total_pagos),     "#86efac"],
            ["Saldo pendiente",   money(saldo), saldo > 0 ? "#f87171" : saldo < 0 ? "#fbbf24" : "#4ade80"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: "#ffffff10", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color }}>{val}</div>
            </div>
          ))}
        </div>
        {saldo > 0 && (
          <div style={{ marginTop: 12, fontSize: 13, color: "#fca5a5", fontWeight: 600 }}>
            ⚠ Saldo pendiente de {money(saldo)}. Registra el pago antes de facturar.
          </div>
        )}
        {saldo === 0 && pagosYd.length > 0 && !factura && (
          <div style={{ marginTop: 12, fontSize: 13, color: "#86efac", fontWeight: 600 }}>
            ✓ Saldo en cero. Puedes generar la factura.
          </div>
        )}
        {factura && (
          <div style={{ marginTop: 12, fontSize: 13, color: "#86efac", fontWeight: 600 }}>
            ✓ Factura #{factura.id} generada — {factura.estado}
          </div>
        )}
      </div>

      {/* ── Cargos ── */}
      <div style={S.card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
          Cargos ({cargos.length})
        </div>
        {cargos.length === 0 ? (
          <div style={{ color: C.gray, fontSize: 13 }}>Sin cargos adicionales.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={S.th}>Fecha</th>
                  <th style={S.th}>Descripción</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {cargos.map(c => (
                  <tr key={c.id}>
                    <td style={S.td}>{fmtF(c.fecha || c.created_at)}</td>
                    <td style={S.td}>{c.referencia || c.descripcion || "—"}</td>
                    <td style={{ ...S.td, textAlign: "right", fontWeight: 600, color: C.red }}>{money(c.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagos y depósitos ── */}
      <div style={S.card}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
          Pagos y depósitos ({pagosYd.length})
        </div>
        {pagosYd.length === 0 ? (
          <div style={{ color: C.gray, fontSize: 13 }}>Sin pagos ni depósitos registrados.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={S.th}>Fecha</th>
                  <th style={S.th}>Tipo</th>
                  <th style={S.th}>Método</th>
                  <th style={S.th}>Referencia</th>
                  <th style={{ ...S.th, textAlign: "right" }}>Monto</th>
                  {!factura && <th style={S.th}></th>}
                </tr>
              </thead>
              <tbody>
                {pagosYd.map(p => (
                  <tr key={p.id}>
                    <td style={S.td}>{fmtF(p.fecha || p.created_at)}</td>
                    <td style={S.td}>{p.tipo}</td>
                    <td style={S.td}>{METODO_LABEL[p.metodo] || p.metodo || "—"}</td>
                    <td style={S.td}>{p.referencia || "—"}</td>
                    <td style={{ ...S.td, textAlign: "right", fontWeight: 600, color: C.green }}>{money(p.monto)}</td>
                    {!factura && (
                      <td style={S.td}>
                        <button
                          onClick={() => eliminarPago(p.id)}
                          disabled={deletingId === p.id}
                          style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontSize: 16, padding: "0 4px" }}
                          title="Eliminar pago"
                        >
                          {deletingId === p.id ? "..." : "🗑"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Registrar pago ── */}
      {!yaFinalizada && reserva.estado === "ocupada" && (
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>
            Registrar pago
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 130px" }}>
              <label style={S.label}>Monto (COP) *</label>
              <input type="number" min={1} value={pMonto} placeholder="Ej: 150000"
                onChange={e => setPMonto(e.target.value)} style={S.input} />
            </div>
            <div style={{ flex: "1 1 160px" }}>
              <label style={S.label}>Método *</label>
              <select value={pMetodo} onChange={e => setPMetodo(e.target.value)}
                style={{ ...S.input, cursor: "pointer" }}>
                {METODOS.map(m => <option key={m} value={m}>{METODO_LABEL[m]}</option>)}
              </select>
            </div>
            <div style={{ flex: "2 1 200px" }}>
              <label style={S.label}>Referencia / observación</label>
              <input type="text" value={pRef} placeholder="Nro. recibo, transacción..."
                onChange={e => setPRef(e.target.value)} style={S.input} />
            </div>
            <button onClick={registrarPago} disabled={pSaving || !pMonto}
              style={{ ...S.btnGreen, opacity: pSaving ? .7 : 1, whiteSpace: "nowrap" }}>
              {pSaving ? "Guardando..." : "Registrar pago"}
            </button>
          </div>
          <Alerta msg={pMsg.text} ok={pMsg.ok} />
        </div>
      )}

      {/* ── Paso 1: Generar factura ── */}
      {!yaFinalizada && (
        <div style={{ ...S.card, border: `1.5px solid ${puedeFacturar ? C.green : C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Paso 1 — Generar factura
          </div>
          {factura ? (
            <div style={{ color: C.green, fontWeight: 600, fontSize: 14 }}>
              ✓ Factura #{factura.id} ya generada.
            </div>
          ) : (
            <>
              <div style={{ color: C.gray, fontSize: 13, marginBottom: 14 }}>
                Se requiere: al menos un pago registrado y saldo exactamente en cero.
                {!puedeFacturar && saldo > 0 && (
                  <span style={{ color: C.red }}> Saldo pendiente: {money(saldo)}.</span>
                )}
                {!puedeFacturar && saldo < -0.5 && (
                  <span style={{ color: C.amber }}> Pago excedente de {money(Math.abs(saldo))}. Elimina el pago sobrante.</span>
                )}
                {!puedeFacturar && pagosYd.length === 0 && (
                  <span style={{ color: C.red }}> No hay pagos registrados.</span>
                )}
              </div>
              <button onClick={generarFactura} disabled={!puedeFacturar || factSaving}
                style={{ ...S.btnGreen, opacity: (!puedeFacturar || factSaving) ? .5 : 1 }}>
                {factSaving ? "Generando..." : "Generar factura"}
              </button>
              <Alerta msg={factMsg.text} ok={factMsg.ok} />
            </>
          )}
        </div>
      )}

      {/* ── Paso 2: Confirmar checkout ── */}
      {!yaFinalizada && (
        <div style={{ ...S.card, border: `1.5px solid ${puedeCheckout ? C.navy : C.border}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
            Paso 2 — Confirmar check-out
          </div>
          {!factura && (
            <div style={{ color: C.gray, fontSize: 13, marginBottom: 14 }}>
              Genera primero la factura para poder confirmar el check-out.
            </div>
          )}
          {factura && (
            <div style={{ color: C.gray, fontSize: 13, marginBottom: 14 }}>
              Al confirmar, la habitación quedará disponible y la reserva pasará a "finalizada".
            </div>
          )}
          <button onClick={confirmarCheckout} disabled={!puedeCheckout || coSaving}
            style={{ ...S.btnPrim, background: puedeCheckout ? C.navy : C.gray, opacity: (!puedeCheckout || coSaving) ? .5 : 1 }}>
            {coSaving ? "Procesando..." : "Confirmar check-out"}
          </button>
          <Alerta msg={coMsg.text} ok={coMsg.ok} />
        </div>
      )}
    </div>
  );
}
