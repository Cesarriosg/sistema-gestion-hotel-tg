// src/components/Notificaciones.jsx 
import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import hotelService from "../services/hotelService";


const COLORES = {
  info:    { bg:"#eff6ff", border:"#93c5fd", text:"#1d4ed8" },
  success: { bg:"#f0fdf4", border:"#86efac", text:"#15803d" },
  warning: { bg:"#fffbeb", border:"#fcd34d", text:"#b45309" },
  error:   { bg:"#fef2f2", border:"#fca5a5", text:"#dc2626" },
};

export default function Notificaciones() {
  const [notifs,  setNotifs]  = useState([]);
  const [abierto, setAbierto] = useState(false);
  const [nuevas,  setNuevas]  = useState(0);
  const socketRef = useRef(null);
  const panelRef  = useRef(null);

  useEffect(() => {
    // Cargar historial inicial
    hotelService.notificaciones()
      .then(r => setNotifs(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});

    // Conectar socket
    const socket = io("http://localhost:4000", { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("notificacion", (n) => {
      setNotifs(prev => [n, ...prev].slice(0, 30));
      setNuevas(prev => prev + 1);
    });
    return () => socket.disconnect();
  }, []);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const fn = (e) => { if (panelRef.current && !panelRef.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const abrir = () => {
    setAbierto(o => !o);
    if (!abierto) {
      setNuevas(0);
      hotelService.marcarLeidas().catch(() => {});
      setNotifs(prev => prev.map(n => ({ ...n, leida: true })));
    }
  };

  return (
    <div ref={panelRef} style={{ position:"relative", display:"inline-block" }}>
      {/* Botón campana */}
      <button onClick={abrir} title="Notificaciones" style={{
        background:"transparent", border:"none", cursor:"pointer",
        position:"relative", padding:"4px 8px", borderRadius:8,
        color: abierto ? "#2563eb" : "#6b7280", lineHeight:1,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {nuevas > 0 && (
          <span style={{
            position:"absolute", top:0, right:0,
            background:"#dc2626", color:"#fff",
            borderRadius:"50%", width:15, height:15, fontSize:9, fontWeight:700,
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>{nuevas > 9 ? "9+" : nuevas}</span>
        )}
      </button>

      {/* Panel */}
      {abierto && (
        <div style={{
          position:"absolute", right:0, top:"calc(100% + 8px)",
          width:340, maxHeight:420, overflowY:"auto",
          background:"#fff", border:"1px solid #e2e8f0",
          borderRadius:12, boxShadow:"0 8px 32px rgba(0,0,0,0.12)", zIndex:9999,
        }}>
          <div style={{ padding:"12px 16px", borderBottom:"1px solid #e2e8f0", fontWeight:700, fontSize:14, color:"#1a1a2e", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <span>Notificaciones</span>
            <span style={{ fontSize:11, color:"#6b7280", fontWeight:400 }}>{notifs.length} total</span>
          </div>
          {notifs.length === 0 ? (
            <div style={{ padding:"32px 16px", textAlign:"center", color:"#6b7280", fontSize:13 }}>Sin notificaciones recientes.</div>
          ) : notifs.map(n => {
            const col = COLORES[n.tipo] || COLORES.info;
            return (
              <div key={n.id} style={{
                padding:"11px 16px", borderBottom:"1px solid #f1f5f9",
                background: n.leida ? "#fff" : col.bg,
                borderLeft: `3px solid ${n.leida ? "#e2e8f0" : col.border}`,
              }}>
                <div style={{ display:"flex", justifyContent:"space-between", gap:8 }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13, color:col.text }}>{n.titulo}</div>
                    <div style={{ fontSize:12, color:"#4b5563", marginTop:2 }}>{n.mensaje}</div>
                  </div>
                  {!n.leida && <div style={{ width:7, height:7, borderRadius:"50%", background:col.text, flexShrink:0, marginTop:4 }} />}
                </div>
                <div style={{ fontSize:11, color:"#9ca3af", marginTop:4 }}>
                  {new Date(n.created_at).toLocaleTimeString("es-CO", { hour:"2-digit", minute:"2-digit" })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}