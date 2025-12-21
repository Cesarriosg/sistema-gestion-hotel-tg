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

    //    editar reserva 
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editDesde, setEditDesde] = useState("");
  const [editHasta, setEditHasta] = useState("");
  const [editNotas, setEditNotas] = useState("");

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    (async () => {
      await obtenerFechaSistema();
      await cargarRack();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const authHeader = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;

  const obtenerFechaSistema = async () => {
    try {
      const r = await axios.get(
        "http://localhost:4000/api/config/fecha-sistema",
        { headers: authHeader }
      );
      setFechaSistema(dayjs(r.data.fecha).format("YYYY-MM-DD"));
    } catch (e) {
      console.error("Error obteniendo fecha del sistema:", e);
    }
  };

  const cargarRack = async () => {
    try {
      const habs = await axios.get(
        "http://localhost:4000/api/habitaciones",
        { headers: authHeader }
      );
      const reservas = await axios.get(
        "http://localhost:4000/api/reservas/calendario",
        { headers: authHeader }
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
          end: r.fecha_fin, // rango [inicio, fin)
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

    const abrirEditarReserva = async () => {
    if (!eventoSel) return;
    setEditError("");
    setEditLoading(true);

    try {
      const r = await axios.get(
        `http://localhost:4000/api/reservas/${eventoSel.id}`,
        { headers: authHeader }
      );

      setEditDesde(dayjs(r.data.fecha_inicio).format("YYYY-MM-DD"));
      setEditHasta(dayjs(r.data.fecha_fin).format("YYYY-MM-DD"));
      setEditNotas(r.data.notas || "");

      setShowEditModal(true);
    } catch (e) {
      console.error("Error cargando reserva para editar:", e);
      alert("No se pudo cargar la reserva para edición.");
    } finally {
      setEditLoading(false);
    }
  };

  const guardarEdicionReserva = async () => {
    if (!eventoSel) return;
    setEditError("");

    if (!editDesde || !editHasta) {
      setEditError("Debe seleccionar desde y hasta.");
      return;
    }
    if (!dayjs(editHasta).isAfter(dayjs(editDesde))) {
      setEditError("La fecha de salida debe ser posterior a la fecha de ingreso.");
      return;
    }

    try {
      setEditLoading(true);
      await axios.put(
        `http://localhost:4000/api/reservas/${eventoSel.id}`,
        {
          fecha_inicio: editDesde,
          fecha_fin: editHasta,
          notas: editNotas?.trim() || null,
        },
        { headers: authHeader }
      );

      // cerrar modales y refrescar rack
      setShowEditModal(false);
      setShowEventModal(false);
      setEventoSel(null);
      await cargarRack();
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;

      if (status === 409) {
        setEditError(msg || "Choque de fechas: la habitación ya tiene una reserva en ese rango.");
        return;
      }
      setEditError(msg || "No se pudo actualizar la reserva.");
    } finally {
      setEditLoading(false);
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
    // permitir checkout desde el día siguiente al check-in
    return !hoy.isBefore(inicio.add(1, "day"), "day");
  })();

  // ---- acciones ----
  const cancelarReserva = async () => {
    if (!eventoSel) return;
    if (!window.confirm("¿Seguro que deseas cancelar esta reserva?")) return;

    try {
      await axios.delete(
        `http://localhost:4000/api/reservas/${eventoSel.id}`,
        { headers: authHeader }
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

  const hacerCheckout = () => {
    if (!eventoSel) return;
    // Aquí solo navegamos al detalle para hacer el flujo:
    // ver estado de cuenta -> generar factura -> botón de checkout final
    navigate(`/reservas/${eventoSel.id}`);
  };

  const verRegistro = () => {
    if (!eventoSel) return;
    navigate(`/reservas/${eventoSel.id}`);
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

            {/* Modal editar reserva */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Editar reserva #{eventoSel?.id}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p className="mb-2">
            <strong>Habitación:</strong> {eventoSel?.habitacion}
          </p>

          <Form.Group className="mb-2">
            <Form.Label>Ingreso</Form.Label>
            <Form.Control
              type="date"
              value={editDesde}
              onChange={(e) => setEditDesde(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Salida</Form.Label>
            <Form.Control
              type="date"
              value={editHasta}
              onChange={(e) => setEditHasta(e.target.value)}
            />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Notas internas</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={editNotas}
              onChange={(e) => setEditNotas(e.target.value)}
              placeholder="Ej: Llegará tarde, requiere cama adicional, etc."
            />
          </Form.Group>

          {editError && (
            <div className="alert alert-danger py-2 mt-2 mb-0">{editError}</div>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)} disabled={editLoading}>
            Cancelar
          </Button>
          <Button variant="warning" onClick={guardarEdicionReserva} disabled={editLoading}>
            {editLoading ? "Guardando..." : "Guardar cambios"}
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
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={verRegistro}
            >
              Ver registro / estado de cuenta
            </Button>

            {eventoSel?.estado === "reservada" && (
              <Button
                variant="outline-warning"
                size="sm"
                onClick={abrirEditarReserva}
                disabled={editLoading}
              >
              Editar reserva 
              </Button>
            )}

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
                Ir a check-out / facturar
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
