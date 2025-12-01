// src/pages/CalendarioRack.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useNavigate } from "react-router-dom";
import { Modal, Button, Form } from "react-bootstrap";

dayjs.locale("es");

export default function CalendarioRack() {
  const [resources, setResources] = useState([]);
  const [events, setEvents] = useState([]);
  const [fechaSistema, setFechaSistema] = useState(
    dayjs().format("YYYY-MM-DD")
  );

  // selección para crear reserva/walkin/bloqueo
  const [slotInfo, setSlotInfo] = useState(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [accion, setAccion] = useState("walkin");

  // selección de evento (reserva existente)
  const [eventoSel, setEventoSel] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      await obtenerFechaSistema();
      await cargarRack();
    })();
  }, []);

  const obtenerFechaSistema = async () => {
    try {
      const r = await axios.get(
        "http://localhost:4000/api/config/fecha-sistema"
      );
      setFechaSistema(dayjs(r.data.fecha).format("YYYY-MM-DD"));
    } catch (e) {
      console.error("Error obteniendo fecha del sistema:", e);
    }
  };

  const cargarRack = async () => {
    try {
      const habs = await axios.get("http://localhost:4000/api/habitaciones");
      const reservas = await axios.get(
        "http://localhost:4000/api/reservas/calendario"
      );

      setResources(
        habs.data.map((h) => ({
          id: h.numero,
          title: `Hab. ${h.numero} — ${h.tipo}`,
        }))
      );

      setEvents(
        reservas.data.map((r) => ({
          id: r.id,
          resourceId: r.habitacion_numero,
          title: r.huesped_nombre,
          start: r.fecha_inicio,
          end: r.fecha_fin, // rango [inicio, fin) => correcto para 1 noche
          display: "block",
          color:
            r.estado === "ocupada"
              ? "#0f7b27"
              : r.estado === "cancelada"
              ? "#888888"
              : r.estado === "finalizada"
              ? "#555555"
              : "#1d6eca",
          extendedProps: {
            estado: r.estado,
            habitacion_numero: r.habitacion_numero,
          },
        }))
      );
    } catch (e) {
      console.error("Error cargando rack:", e);
    }
  };

  const nowValue = useMemo(() => {
    return dayjs(fechaSistema)
      .hour(12)
      .minute(0)
      .second(0)
      .toDate();
  }, [fechaSistema]);

  const esHoyDelSistema = (yymmdd) => yymmdd === fechaSistema;

  // ---- Selección de rango para crear algo nuevo ----
  const handleSelect = (arg) => {
    const start = dayjs(arg.start).format("YYYY-MM-DD");
    const end = dayjs(arg.end).format("YYYY-MM-DD");

    setSlotInfo({
      habNumero: arg.resource.id,
      habNombre: arg.resource.title,
      start,
      end,
    });

    setAccion("walkin");
    setShowSlotModal(true);
  };

  const handleCloseSlotModal = () => {
    setShowSlotModal(false);
    setSlotInfo(null);
  };

  const handleAceptarSlot = () => {
    if (!slotInfo) return;

    const { habNumero, start, end } = slotInfo;

    if (accion === "walkin") {
      if (!esHoyDelSistema(start)) {
        alert(
          "El registro Walk-In solo se permite para el día operativo actual."
        );
        return;
      }
      navigate(
        `/walkin/nuevo?hab=${habNumero}&desde=${start}&hasta=${end}`
      );
    } else if (accion === "reserva") {
      navigate(
        `/reservas/nueva?hab=${habNumero}&desde=${start}&hasta=${end}`
      );
    } else if (accion === "bloqueo_mantenimiento") {
      navigate(
        `/bloqueos/nuevo?tipo=mantenimiento&hab=${habNumero}&desde=${start}&hasta=${end}`
      );
    } else if (accion === "bloqueo_administrativo") {
      navigate(
        `/bloqueos/nuevo?tipo=administrativo&hab=${habNumero}&desde=${start}&hasta=${end}`
      );
    }

    setShowSlotModal(false);
  };

  // ---- Click sobre una reserva existente ----
  const handleEventClick = (info) => {
    const e = info.event;
    const start = dayjs(e.start).format("YYYY-MM-DD");
    const end = dayjs(e.end).format("YYYY-MM-DD");

    setEventoSel({
      id: e.id,
      titulo: e.title,
      habitacion:
        e.extendedProps?.habitacion_numero || e.getResources?.()[0]?.id,
      start,
      end,
      estado: e.extendedProps?.estado || "reservada",
    });
    setShowEventModal(true);
  };

  const handleCloseEventModal = () => {
    setShowEventModal(false);
    setEventoSel(null);
  };

  // ---- reglas de negocio para botones ----
  const puedeCheckIn = (() => {
    if (!eventoSel) return false;
    if (eventoSel.estado !== "reservada") return false;
    const hoy = dayjs(fechaSistema);
    const inicio = dayjs(eventoSel.start);
    const fin = dayjs(eventoSel.end);
    // hoy ∈ [inicio, fin)
    return !hoy.isBefore(inicio, "day") && hoy.isBefore(fin, "day");
  })();

  const puedeCancelar = eventoSel?.estado === "reservada";

  const puedeCheckout = (() => {
    if (!eventoSel) return false;
    if (eventoSel.estado !== "ocupada") return false;
    const hoy = dayjs(fechaSistema);
    const inicio = dayjs(eventoSel.start);
    // por simplicidad: permitir checkout desde el día siguiente al check-in
    return !hoy.isBefore(inicio.add(1, "day"), "day");
  })();

  // ---- acciones ----
  const cancelarReserva = async () => {
    if (!eventoSel) return;
    if (!window.confirm("¿Seguro que deseas cancelar esta reserva?")) return;

    try {
      await axios.delete(
        `http://localhost:4000/api/reservas/${eventoSel.id}`
      );
      await cargarRack();
      setShowEventModal(false);
    } catch (e) {
      console.error("Error cancelando reserva:", e);
      alert("No se pudo cancelar la reserva.");
    }
  };

  const irCheckIn = () => {
    if (!eventoSel) return;
    navigate(`/checkin/${eventoSel.id}`);
  };

  const hacerCheckout = async () => {
    if (!eventoSel) return;
    if (!window.confirm("¿Confirmar check-out de esta reserva?")) return;

    try {
      await axios.post(
        `http://localhost:4000/api/reservas/${eventoSel.id}/checkout`
      );
      await cargarRack();
      setShowEventModal(false);
    } catch (e) {
      console.error("Error en check-out:", e);
      alert("No se pudo realizar el check-out.");
    }
  };

  return (
    <div style={{ padding: 10 }}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h2 className="mb-0">🏨 Rack Interactivo de Habitaciones</h2>
        <span className="badge bg-secondary">
          Fecha operativa del hotel: {fechaSistema}
        </span>
      </div>

      <FullCalendar
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
        locale="es"
        initialView="resourceTimelineWeek"
        initialDate={fechaSistema}
        nowIndicator={true}
        now={() => nowValue}
        height="82vh"
        resourceAreaWidth="260px"
        resources={resources}
        events={events}
        selectable={true}
        selectMirror={true}
        select={handleSelect}
        eventClick={handleEventClick}
        unselectAuto={true}
        slotDuration="24:00:00"
        slotLabelFormat={[
          { weekday: "short", month: "numeric", day: "numeric" },
        ]}
        headerToolbar={{
          left: "today prev next",
          center: "title",
          right:
            "resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth",
        }}
        views={{
          resourceTimelineDay: { slotDuration: "24:00:00" },
          resourceTimelineWeek: { slotDuration: "24:00:00" },
          resourceTimelineMonth: { slotDuration: { days: 1 } },
        }}
        eventContent={(info) => (
          <div style={{ fontSize: 12, padding: 2, fontWeight: 600 }}>
            {info.event.title}
          </div>
        )}
      />

      {/* Modal creación desde rango */}
      <Modal show={showSlotModal} onHide={handleCloseSlotModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Rack Interactivo</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>
            <strong>Habitación:</strong> {slotInfo?.habNombre}
          </p>
          <p>
            <strong>Rango:</strong> {slotInfo?.start} → {slotInfo?.end}
          </p>

          <Form>
            <Form.Label className="mt-2">
              Seleccione el elemento a crear
            </Form.Label>

            <Form.Check
              type="radio"
              name="accionRack"
              id="accion-walkin"
              label="Registro Walk-In"
              value="walkin"
              checked={accion === "walkin"}
              onChange={(e) => setAccion(e.target.value)}
            />

            <Form.Check
              type="radio"
              name="accionRack"
              id="accion-reserva"
              label="Reserva Individual"
              value="reserva"
              checked={accion === "reserva"}
              onChange={(e) => setAccion(e.target.value)}
            />

            <Form.Check
              type="radio"
              name="accionRack"
              id="accion-bloqueo-mant"
              label="Bloqueo por Mantenimiento"
              value="bloqueo_mantenimiento"
              checked={accion === "bloqueo_mantenimiento"}
              onChange={(e) => setAccion(e.target.value)}
            />

            <Form.Check
              type="radio"
              name="accionRack"
              id="accion-bloqueo-adm"
              label="Bloqueo Administrativo"
              value="bloqueo_administrativo"
              checked={accion === "bloqueo_administrativo"}
              onChange={(e) => setAccion(e.target.value)}
            />
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="success" onClick={handleAceptarSlot}>
            Aceptar
          </Button>
          <Button variant="secondary" onClick={handleCloseSlotModal}>
            Cancelar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal de acciones sobre la reserva */}
      <Modal show={showEventModal} onHide={handleCloseEventModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reserva #{eventoSel?.id}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>
            <strong>Huésped:</strong> {eventoSel?.titulo}
          </p>
          <p>
            <strong>Habitación:</strong> {eventoSel?.habitacion}
          </p>
          <p>
            <strong>Rango:</strong> {eventoSel?.start} → {eventoSel?.end}
          </p>
          <p>
            <strong>Estado:</strong> {eventoSel?.estado}
          </p>

          <hr />

          <p>Acciones disponibles:</p>
          <div className="d-flex flex-column gap-2">
            {eventoSel?.estado === "reservada" && (
              <Button
                variant="outline-primary"
                size="sm"
                disabled={!puedeCheckIn}
                onClick={irCheckIn}
              >
                Check-In
              </Button>
            )}

            {eventoSel?.estado === "ocupada" && (
              <Button
                variant="outline-success"
                size="sm"
                disabled={!puedeCheckout}
                onClick={hacerCheckout}
              >
                Check-Out
              </Button>
            )}

            <Button
              variant="outline-danger"
              size="sm"
              onClick={cancelarReserva}
              disabled={!puedeCancelar}
            >
              Cancelar reserva
            </Button>
          </div>

          {eventoSel?.estado === "reservada" && !puedeCheckIn && (
            <p className="mt-3 text-muted" style={{ fontSize: "0.9rem" }}>
              El check-in solo se permite cuando la fecha operativa del hotel
              está dentro del rango de la reserva.
            </p>
          )}

          {eventoSel?.estado === "ocupada" && !puedeCheckout && (
            <p className="mt-3 text-muted" style={{ fontSize: "0.9rem" }}>
              El check-out solo se permite a partir del día siguiente al
              check-in según la fecha operativa del hotel.
            </p>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEventModal}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
