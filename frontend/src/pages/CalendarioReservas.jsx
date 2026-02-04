import { useEffect, useState } from "react";
import axios from "axios";
import { Calendar, dayjsLocalizer } from "react-big-calendar";
import dayjs from "dayjs";
import "dayjs/locale/es";
import "react-big-calendar/lib/css/react-big-calendar.css";

dayjs.locale("es");
const localizer = dayjsLocalizer(dayjs);

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function CalendarioReservas() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const cargarReservas = async () => {
      try {
        const res = await axios.get(`${API}/api/reservas/calendario`, {
          headers: getAuthHeaders(),
        });

        const data = (res.data || []).map((r) => ({
          title: `${r.habitacion_numero} - ${r.huesped_nombre}`,
          start: new Date(r.fecha_inicio),
          end: new Date(r.fecha_fin),
        }));

        setEvents(data);
      } catch (err) {
        console.error("Error cargando reservas:", err);
      }
    };

    cargarReservas();
  }, []);

  return (
    <div style={{ height: "90vh", padding: "20px" }}>
      <h2>Calendario de Reservas</h2>
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        views={["month", "week", "day"]}
        defaultView="month"
        culture="es"
        style={{ height: "100%", marginTop: "20px" }}
      />
    </div>
  );
}
