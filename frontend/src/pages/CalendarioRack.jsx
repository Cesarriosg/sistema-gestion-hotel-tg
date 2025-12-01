// src/pages/CalendarioRack.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useNavigate } from "react-router-dom";

dayjs.locale("es");

export default function CalendarioRack() {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [fechaSistema, setFechaSistema] = useState(dayjs().format("YYYY-MM-DD"));

  // selección hecha en el drag del rack
  const [sel, setSel] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      await obtenerFechaSistema();
      await cargarRack();
    })();
  }, []);

  const obtenerFechaSistema = async () => {
    try {
      const r = await axios.get("http://localhost:4000/api/config/fecha-sistema");
      setFechaSistema(dayjs(r.data.fecha).format("YYYY-MM-DD"));
    } catch (e) {
      console.error("Error obteniendo fecha del sistema:", e);
    }
  };

  const cargarRack = async () => {
    const habs = await axios.get("http://localhost:4000/api/habitaciones");
    const reservas = await axios.get("http://localhost:4000/api/reservas/calendario");

    setResources(
      habs.data.map(h => ({
        id: h.numero, // usamos numero como resourceId
        title: `Hab. ${h.numero} — ${h.tipo}`,
      }))
    );

    setEvents(
      reservas.data.map(r => ({
        id: r.id,
        resourceId: r.habitacion_numero,
        title: r.huesped_nombre,
        start: r.fecha_inicio,
        end: r.fecha_fin,
        display: "block",
        color: r.estado === "ocupada" ? "#0f7b27" : "#1d6eca",
      }))
    );
  };

  // ⚠️ FullCalendar usa "now" para pintar el nowIndicator.
  // Lo forzamos a la fecha operativa (mediodía para que caiga dentro del día).
  const nowValue = useMemo(() => {
    return dayjs(fechaSistema).hour(12).minute(0).second(0).toDate();
  }, [fechaSistema]);

  // Al seleccionar (drag) un rango en un recurso
  const onSelect = (arg) => {
    const start = dayjs(arg.start).format("YYYY-MM-DD");
    const end = dayjs(arg.end).format("YYYY-MM-DD");
    setSel({
      habNumero: arg.resource.id,
      start,
      end,
    });
  };

  const cerrarModal = () => setSel(null);

  const irCrearReserva = () => {
    // Pasamos por query params lo que seleccionó
    navigate(`/reservas/nueva?hab=${sel.habNumero}&desde=${sel.start}&hasta=${sel.end}`);
  };

  const irCrearWalkIn = () => {
    navigate(`/walkin/nuevo?hab=${sel.habNumero}&desde=${sel.start}&hasta=${sel.end}`);
  };

  const esHoyDelSistema = (yymmdd) => yymmdd === fechaSistema;

  return (
    <div style={{ padding: 10 }}>
      <h2 style={{ marginBottom: 12 }}>🏨 Rack Interactivo de Habitaciones</h2>

      <FullCalendar
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
        locale="es"
        initialView="resourceTimelineWeek"
        initialDate={fechaSistema}
        nowIndicator={true}
        now={() => nowValue}                  // ✅ línea roja en "fecha del sistema"
        height="82vh"
        resourceAreaWidth="260px"
        resources={resources}
        events={events}
        selectable={true}
        selectMirror={true}
        select={onSelect}
        unselectAuto={true}
        slotDuration="24:00:00"
        slotLabelFormat={[{ weekday: "short", month: "numeric", day: "numeric" }]}
        headerToolbar={{
          left: "today prev next",
          center: "title",
          right: "resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth",
        }}
        views={{
          resourceTimelineDay: { slotDuration: "24:00:00" },
          resourceTimelineWeek: { slotDuration: "24:00:00" },
          resourceTimelineMonth: { slotDuration: { days: 1 } },
        }}
        eventContent={(info) => (
          <div style={{ fontSize: 12, padding: 2, fontWeight: 600 }}>{info.event.title}</div>
        )}
      />

      {/* Modal simple – acciones sobre la selección */}
      {sel && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
          onClick={cerrarModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 520,
              maxWidth: "92vw",
              background: "#fff",
              borderRadius: 10,
              padding: 22,
              boxShadow: "0 10px 30px rgba(0,0,0,.2)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Acciones sobre la selección</h3>
            <p style={{ margin: "6px 0" }}>
              <strong>Habitación:</strong> {sel.habNumero}
            </p>
            <p style={{ margin: "6px 0" }}>
              <strong>Rango:</strong> {sel.start} → {sel.end}
            </p>

            <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
              <button
                className="btn btn-primary"
                onClick={irCrearReserva}
                style={{ padding: "8px 14px" }}
              >
                Crear reserva
              </button>

              {/* Walk-In solo si el start es el hoy del sistema */}
              {esHoyDelSistema(sel.start) && (
                <button
                  className="btn btn-success"
                  onClick={irCrearWalkIn}
                  style={{ padding: "8px 14px" }}
                >
                  Registrar Walk-In
                </button>
              )}

              <button className="btn" onClick={cerrarModal} style={{ padding: "8px 14px" }}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
