// src/pages/OTAs.jsx
// Reservas recibidas desde canales OTA (Channex → Booking.com, Airbnb, etc.)
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import reservasService from "../services/reservasService";

// ota_payload puede llegar como objeto o como string JSON
const parsePayload = (p) => {
  if (!p) return {};
  if (typeof p === "string") { try { return JSON.parse(p); } catch { return {}; } }
  return p;
};

// Prefijos que Channex usa en booking_unique_id para identificar la OTA de origen:
// BDC-  = Booking.com
// ABB-  = Airbnb (Airbnb Booking)
// ALC-  = Airbnb (Airbnb Listing Channel)
// EXP-  = Expedia
// HRS-  = HRS
// AGOD- = Agoda
// HB-   = Hotelbeds
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
  // El uid puede venir del payload crudo de Channex o del ota_reserva_id guardado
  const uid = pl?.raw?.payload?.booking_unique_id
           || pl?.booking_unique_id
           || id;

  // Buscar por prefijo conocido
  for (const ota of PREFIJOS_OTA) {
    if (ota.prefijos.some(p => uid.toUpperCase().startsWith(p) || id.toUpperCase().startsWith(p)))
      return ota;
  }

  // Sin prefijo reconocido — mostrar el canal genérico
  if (r.ota_canal === "sandbox") return { label: "Sandbox",  color: "#6b7280", bg: "#f3f4f6" };
  if (r.ota_canal || r.fuente)  return { label: "Channex",  color: "#2563eb", bg: "#eff6ff" };
  return                               { label: "OTA",      color: "#374151", bg: "#f3f4f6" };
};

// Mostrar el ID de la reserva en la plataforma OTA (sin el prefijo de canal)
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

export default function OTAs() {
  const navigate = useNavigate();
  const [reservas, setReservas] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [filtro,   setFiltro]   = useState("todos");

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

  // Conteo por canal para las tarjetas
  const conteo = reservas.reduce((acc, r) => {
    const label = detectarCanal(r).label;
    acc[label] = (acc[label] || 0) + 1;
    return acc;
  }, {});

  const filtradas = filtro === "todos"
    ? reservas
    : reservas.filter(r => detectarCanal(r).label === filtro);

  return (
    <div style={{ padding: "24px", maxWidth: 1100, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, color: "#1a1a2e", fontSize: 22 }}>Reservas OTA</h2>
          <p style={{ margin: "4px 0 0", color: "#6b7280", fontSize: 13 }}>
            Reservas recibidas desde canales externos via Channex
          </p>
        </div>
        <button onClick={cargar}
          style={{ background: "#f3f4f6", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151" }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Tarjetas por canal — cliqueables para filtrar */}
      {Object.keys(conteo).length > 0 && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {Object.entries(conteo).map(([label, total]) => {
            const r0 = reservas.find(r => detectarCanal(r).label === label);
            const ci = r0 ? detectarCanal(r0) : { color: "#374151", bg: "#f3f4f6" };
            const activo = filtro === label;
            return (
              <div key={label} onClick={() => setFiltro(activo ? "todos" : label)}
                style={{
                  background: activo ? ci.color : ci.bg,
                  border: `2px solid ${ci.color}`,
                  borderRadius: 10, padding: "12px 22px",
                  cursor: "pointer", minWidth: 120, textAlign: "center",
                }}>
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

      {/* Tabla */}
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
                {["#", "Canal", "ID Reserva OTA", "Huésped", "Habitación", "Check-in", "Check-out", "Noches", "Estado", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: .4 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtradas.map((r, i) => {
                const ci    = detectarCanal(r);
                const es    = ESTADO[r.estado] || ESTADO.finalizada;
                const noches = r.fecha_inicio && r.fecha_fin
                  ? dayjs(r.fecha_fin).diff(dayjs(r.fecha_inicio), "day") : "—";
                const pl    = parsePayload(r.ota_payload);
                const nombre = r.huesped_nombre
                  || pl?.customer_name
                  || pl?.raw?.payload?.customer_name
                  || "—";
                return (
                  <tr key={r.id} style={{ borderBottom: "1px solid #f3f4f6", background: i % 2 === 0 ? "#fff" : "#fafafa" }}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, color: "#1a1a2e" }}>#{r.id}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: ci.bg, color: ci.color, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
                        {ci.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontFamily: "monospace", fontSize: 12, color: "#374151", fontWeight: 500 }}>
                      {otaIdVisible(r)}
                    </td>
                    <td style={{ padding: "12px 14px", fontWeight: 500 }}>{nombre}</td>
                    <td style={{ padding: "12px 14px" }}>
                      {r.habitacion_numero ? `Hab. ${r.habitacion_numero}` : "—"}
                      {r.habitacion_tipo && <span style={{ color: "#9ca3af", marginLeft: 4, fontSize: 11 }}>— {r.habitacion_tipo}</span>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>{fmt(r.fecha_inicio)}</td>
                    <td style={{ padding: "12px 14px" }}>{fmt(r.fecha_fin)}</td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>{noches}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ background: es.bg, color: es.color, borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 600 }}>
                        {r.estado}
                      </span>
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