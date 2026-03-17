// src/pages/FichaHuesped.jsx  — RF-06: Historial de estancias por huésped
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import dayjs from "dayjs";
import huespedesService from "../services/huespedesService";

const fmt   = (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "—");
const money = (v) => Number(v||0).toLocaleString("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});
const noches = (ini,fin) => Math.max(0,dayjs(fin).diff(dayjs(ini),"day"));

const C = {navy:"#1a1a2e",blue:"#2563eb",green:"#16a34a",red:"#dc2626",amber:"#d97706",gray:"#6b7280",light:"#f8fafc",border:"#e2e8f0",white:"#ffffff"};
const ESTADO_C = {ocupada:"#dc2626",reservada:"#2563eb",finalizada:"#16a34a",cancelada:"#6b7280",no_show:"#d97706"};
const card = {background:C.white,border:`1px solid ${C.border}`,borderRadius:12,padding:24,marginBottom:16};
const kpiW = {background:C.light,border:`1px solid ${C.border}`,borderRadius:10,padding:"14px 18px"};

const EstadoBadge = ({estado}) => {
  const color = ESTADO_C[estado]||C.gray;
  return <span style={{background:color+"18",color,border:`1px solid ${color}40`,borderRadius:6,padding:"2px 10px",fontSize:12,fontWeight:600}}>{(estado||"").replace("_"," ")}</span>;
};

export default function FichaHuesped() {
  const {id}  = useParams();
  const nav   = useNavigate();
  const [huesped,  setHuesped]  = useState(null);
  const [hist,     setHist]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState("");
  const [filtro,   setFiltro]   = useState("todos");

  const cargar = useCallback(async () => {
    setLoading(true); setErr("");
    try {
      const [rH,rHist] = await Promise.all([
        huespedesService.obtener(id),
        huespedesService.historial(id),
      ]);
      setHuesped(rH.data);
      setHist(rHist.data);
    } catch(e) { setErr(e?.response?.data?.message||"Error al cargar ficha."); }
    finally    { setLoading(false); }
  },[id]);

  useEffect(()=>{cargar();},[cargar]);

  if (loading) return <div style={{textAlign:"center",padding:60,color:C.gray,fontFamily:"system-ui"}}>Cargando ficha...</div>;
  if (err)     return (
    <div style={{maxWidth:700,margin:"40px auto",padding:24,fontFamily:"system-ui"}}>
      <div style={{background:"#fef2f2",border:`1px solid ${C.red}40`,borderRadius:8,padding:16,color:C.red,marginBottom:12}}>{err}</div>
      <button onClick={()=>nav(-1)} style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 18px",cursor:"pointer"}}>Volver</button>
    </div>
  );
  if (!huesped) return null;

  const est      = hist?.estadisticas||{};
  const reservas = (hist?.reservas||[]).filter(r=>filtro==="todos"||r.estado===filtro);

  return (
    <div style={{maxWidth:980,margin:"0 auto",padding:"24px 16px",fontFamily:"system-ui, sans-serif"}}>

      {/* Cabecera */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24,flexWrap:"wrap",gap:12}}>
        <div>
          <h2 style={{margin:0,fontSize:22,fontWeight:800,color:C.navy}}>{huesped.nombre_completo}</h2>
          <div style={{color:C.gray,fontSize:13,marginTop:2}}>
            {huesped.tipo_documento} {huesped.documento}
            {huesped.nacionalidad ? ` · ${huesped.nacionalidad}` : ""}
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>nav("/huespedes")} style={{background:C.blue,color:"#fff",border:"none",borderRadius:8,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            Lista de huéspedes
          </button>
          <button onClick={()=>nav(-1)} style={{background:C.white,color:C.gray,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer"}}>
            Volver
          </button>
        </div>
      </div>

      {/* Datos personales */}
      <div style={card}>
        <div style={{fontSize:11,fontWeight:700,color:C.gray,letterSpacing:1.2,textTransform:"uppercase",marginBottom:14}}>Datos personales</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0 32px"}}>
          {[
            ["Nombre completo", huesped.nombre_completo],
            ["Documento",       `${huesped.tipo_documento||""} ${huesped.documento||""}`],
            ["Teléfono",        huesped.telefono],
            ["Email",           huesped.email],
            ["Nacionalidad",    huesped.nacionalidad],
            ["Ciudad",          huesped.ciudad],
            ["Dirección",       huesped.direccion],
            ["Registrado",      fmt(huesped.created_at)],
          ].filter(([,v])=>(v||"").toString().trim()).map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:`1px solid ${C.border}`,fontSize:14}}>
              <span style={{color:C.gray}}>{l}</span>
              <span style={{color:C.navy,fontWeight:500,textAlign:"right",maxWidth:260}}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:12,marginBottom:16}}>
        {[
          ["Total estadías",       est.total_estadias       ??0,C.blue],
          ["Como titular",         est.estadias_titular     ??0,C.navy],
          ["Como acompañante",     est.estadias_acompanante ??0,C.gray],
          ["Noches totales",       est.total_noches         ??0,C.green],
          ["Prom. noches/estadía", est.promedio_noches      ??0,C.amber],
          ["Total pagado",         money(est.total_pagado),    C.green],
        ].map(([label,value,color])=>(
          <div key={label} style={kpiW}>
            <div style={{fontSize:10,color:C.gray,fontWeight:700,textTransform:"uppercase",letterSpacing:0.8,marginBottom:4}}>{label}</div>
            <div style={{fontSize:20,fontWeight:700,color}}>{value}</div>
          </div>
        ))}
      </div>

      {est.primera_visita && (
        <div style={{...card,padding:"12px 20px",display:"flex",gap:32,flexWrap:"wrap",marginBottom:16}}>
          <div style={{fontSize:13}}><span style={{color:C.gray}}>Primera visita: </span><strong>{fmt(est.primera_visita)}</strong></div>
          <div style={{fontSize:13}}><span style={{color:C.gray}}>Última visita: </span><strong>{fmt(est.ultima_visita)}</strong></div>
        </div>
      )}

      {/* Tabla historial */}
      <div style={card}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,flexWrap:"wrap",gap:8}}>
          <div style={{fontSize:11,fontWeight:700,color:C.gray,letterSpacing:1.2,textTransform:"uppercase"}}>
            Historial de estadías ({hist?.reservas?.length??0})
          </div>
          <select value={filtro} onChange={e=>setFiltro(e.target.value)}
            style={{border:`1px solid ${C.border}`,borderRadius:8,padding:"6px 12px",fontSize:13,color:C.navy}}>
            <option value="todos">Todos los estados</option>
            <option value="finalizada">Finalizadas</option>
            <option value="ocupada">Ocupadas</option>
            <option value="reservada">Reservadas</option>
            <option value="cancelada">Canceladas</option>
            <option value="no_show">No show</option>
          </select>
        </div>

        {reservas.length===0 ? (
          <div style={{textAlign:"center",color:C.gray,padding:"32px 0",fontSize:14}}>Sin estadías con este filtro.</div>
        ) : (
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`}}>
                  {["Reserva","Habitación","Entrada","Salida","Noches","Plan","Fuente","Rol","Estado","Total pagado"].map(h=>(
                    <th key={h} style={{padding:"8px 10px",textAlign:"left",color:C.gray,fontWeight:600,fontSize:11,textTransform:"uppercase",whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reservas.map(r=>(
                  <tr key={`${r.id}-${r.rol}`}
                    style={{borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}
                    onClick={()=>nav(`/registro/${r.id}`)}
                    onMouseEnter={e=>e.currentTarget.style.background=C.light}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  >
                    <td style={{padding:"10px",color:C.blue,fontWeight:600}}>#{r.id}</td>
                    <td style={{padding:"10px",fontWeight:500}}>{r.habitacion_numero} — {r.habitacion_tipo}</td>
                    <td style={{padding:"10px",whiteSpace:"nowrap"}}>{fmt(r.fecha_inicio)}</td>
                    <td style={{padding:"10px",whiteSpace:"nowrap"}}>{fmt(r.fecha_fin)}</td>
                    <td style={{padding:"10px",textAlign:"center",fontWeight:600}}>{noches(r.fecha_inicio,r.fecha_fin)}</td>
                    <td style={{padding:"10px"}}>{r.plan||"—"}</td>
                    <td style={{padding:"10px",color:C.gray}}>{r.fuente||"—"}</td>
                    <td style={{padding:"10px"}}>
                      <span style={{background:r.rol==="titular"?C.blue+"18":C.gray+"18",color:r.rol==="titular"?C.blue:C.gray,borderRadius:6,padding:"2px 8px",fontSize:11,fontWeight:600}}>
                        {r.rol}
                      </span>
                    </td>
                    <td style={{padding:"10px"}}><EstadoBadge estado={r.estado}/></td>
                    <td style={{padding:"10px",fontWeight:600,color:C.green}}>
                      {r.rol==="titular" ? money(r.total_pagado) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}