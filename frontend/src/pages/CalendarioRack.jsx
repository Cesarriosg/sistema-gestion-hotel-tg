// src/pages/CalendarioRack.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useNavigate } from "react-router-dom";
import { Modal, Button, Form, Badge } from "react-bootstrap";
import {io} from "socket.io-client";

dayjs.locale("es");

const socket = io("http://localhost:4000", { transports: ["websocket"] });

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const badgeVariant = (estado) => {
  if (estado === "disponible") return "success";
  if (estado === "reservada") return "info";
  if (estado === "ocupada") return "danger";
  if (estado === "mantenimiento") return "warning";
  if (estado === "fuera_servicio") return "secondary";
  return "dark";
};

// rango [inicio, fin)
const enRango = (hoy, inicio, fin) => {
  const H = dayjs(hoy);
  const I = dayjs(inicio);
  const F = dayjs(fin);
  return !H.isBefore(I, "day") && H.isBefore(F, "day");
};

// prioridad: mantenimiento > bloqueo adm > ocupada > reservada > disponible
const calcularEstadoOperativo = ({ fechaSistema, roomNumero, reservas, bloqueos }) => {
  // bloqueos HOY
  const bHoy = (bloqueos || []).find(
    (b) =>
      String(b.habitacion_numero) === String(roomNumero) &&
      enRango(fechaSistema, b.fecha_inicio, b.fecha_fin)
  );

  if (bHoy) {
    if (bHoy.tipo === "mantenimiento") return "mantenimiento";
    return "fuera_servicio"; // bloqueo administrativo
  }

  // reservas HOY
  const rHoy = (reservas || []).find(
    (r) =>
      String(r.habitacion_numero) === String(roomNumero) &&
      enRango(fechaSistema, r.fecha_inicio, r.fecha_fin)
  );

  if (rHoy) {
    if (rHoy.estado === "ocupada") return "ocupada";
    if (rHoy.estado === "reservada") return "reservada";
  }

  return "disponible";
};

export default function CalendarioRack() {
  const [resources, setResources] = useState([]); // habitaciones con estado_operativo
  const [events, setEvents] = useState([]);
  const [fechaSistema, setFechaSistema] = useState(dayjs().format("YYYY-MM-DD"));

  // filtros tipo Zeus
  const [fEstado, setFEstado] = useState("todas");
  const [fTipo, setFTipo] = useState("todas");
  const [fQ, setFQ] = useState("");

  // selección para crear reserva/walkin/bloqueo
  const [slotInfo, setSlotInfo] = useState(null);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [accion, setAccion] = useState("walkin");

  // selección de evento (reserva o bloqueo)
  const [eventoSel, setEventoSel] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);

  // editar reserva
  const [showEditModal, setShowEditModal] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editDesde, setEditDesde] = useState("");
  const [editHasta, setEditHasta] = useState("");
  const [editNotas, setEditNotas] = useState("");

  // ✅ Modal cambiar estado habitación
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  const [habSel, setHabSel] = useState(null); // {dbId, numero, tipo, estado_operativo, estado_base}
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [estadoLoading, setEstadoLoading] = useState(false);
  const [estadoError, setEstadoError] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
  socket.on("rack:update", () => {
    cargarRack();
  });

  return () => {
    socket.off("rack:update");
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);


  useEffect(() => {
    (async () => {
      await obtenerFechaSistema();
      // OJO: cargarRack depende de fechaSistema; se recarga en el useEffect de abajo también.
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Cada vez que cambie fechaSistema, recarga el rack para recalcular estado_operativo
  useEffect(() => {
  const t = setInterval(() => {
    cargarRack();
  }, 10000); // cada 10

  return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [fechaSistema]);


  const obtenerFechaSistema = async () => {
    try {
      const r = await axios.get(`${API}/api/config/fecha-sistema`, {
        headers: getAuthHeaders(),
      });
      setFechaSistema(dayjs(r.data.fecha).format("YYYY-MM-DD"));
    } catch (e) {
      console.error("Error obteniendo fecha del sistema:", e);
    }
  };

  const cargarRack = async () => {
    try {
      const [habsR, reservasR] = await Promise.all([
        axios.get(`${API}/api/habitaciones`, { headers: getAuthHeaders() }),
        axios.get(`${API}/api/reservas/calendario`, { headers: getAuthHeaders() }),
      ]);

      // bloqueos pueden fallar si no está montado; no rompemos todo
      let bloqueos = [];
      try {
        const bloqsR = await axios.get(`${API}/api/bloqueos/calendario`, {
          headers: getAuthHeaders(),
        });
        bloqueos = bloqsR.data || [];
      } catch (e) {
        console.warn("No se pudieron cargar bloqueos:", e?.response?.data?.message || e.message);
        bloqueos = [];
      }

      const habs = habsR.data || [];
      const reservas = reservasR.data || [];

      // ✅ habitaciones con estado_operativo (ZEUS: depende de fechaSistema)
      const habitaciones = habs.map((h) => {
        const estado_operativo = calcularEstadoOperativo({
          fechaSistema,
          roomNumero: h.numero,
          reservas,
          bloqueos,
        });

        return {
          dbId: h.id,
          numero: String(h.numero),
          tipo: h.tipo,
          estado_base: h.estado, // lo guardado en DB (informativo)
          estado_operativo, // ✅ manda para HOY
        };
      });

      setResources(habitaciones);

      // eventos reservas
      const eventosReservas = reservas.map((r) => ({
        id: `R-${r.id}`,
        resourceId: String(r.habitacion_numero),
        title: r.huesped_nombre,
        start: r.fecha_inicio,
        end: r.fecha_fin,
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
          kind: "reserva",
          reserva_id: r.id,
          estado: r.estado,
          habitacion_numero: r.habitacion_numero,
        },
      }));

      // eventos bloqueos
      const eventosBloqueos = (bloqueos || []).map((b) => ({
        id: `B-${b.id}`,
        resourceId: String(b.habitacion_numero),
        title: b.tipo === "mantenimiento" ? "🛠 MANTENIMIENTO" : "🚫 BLOQUEO ADM",
        start: b.fecha_inicio,
        end: b.fecha_fin,
        display: "block",
        color: b.tipo === "mantenimiento" ? "#f59e0b" : "#111827",
        extendedProps: {
          kind: "bloqueo",
          bloqueo_id: b.id,
          tipo: b.tipo,
          motivo: b.motivo || "",
          habitacion_numero: b.habitacion_numero,
        },
      }));

      setEvents([...eventosReservas, ...eventosBloqueos]);
    } catch (e) {
      console.error("Error cargando rack:", e);
      alert(e?.response?.data?.message || "Error cargando rack.");
    }
  };

  // ✅ tipos reales (para que el filtro por tipo SI funcione)
  const tiposDisponibles = useMemo(() => {
    return Array.from(new Set((resources || []).map((h) => String(h.tipo)))).sort();
  }, [resources]);

  // ✅ recursos filtrados (Zeus) usando estado_operativo
  const resourcesFiltradas = useMemo(() => {
    const q = (fQ || "").trim();
    return (resources || [])
      .filter((h) => {
        if (fEstado !== "todas" && h.estado_operativo !== fEstado) return false;
        if (fTipo !== "todas" && String(h.tipo) !== String(fTipo)) return false;
        if (q && !String(h.numero).includes(q)) return false;
        return true;
      })
      .map((h) => ({
        id: String(h.numero),
        title: `Hab. ${h.numero} — ${h.tipo}`,
        extendedProps: {
          dbId: h.dbId,
          estado: h.estado_operativo, // ✅ para badge y lógica
          estado_base: h.estado_base,
          tipo: h.tipo,
          numero: h.numero,
        },
      }));
  }, [resources, fEstado, fTipo, fQ]);

  // ✅ conteos según estado_operativo (HOY)
  const conteos = useMemo(() => {
    const base = resources || [];
    const c = {
      total: base.length,
      disponible: 0,
      reservada: 0,
      ocupada: 0,
      mantenimiento: 0,
      fuera_servicio: 0,
    };
    for (const h of base) {
      const est = h.estado_operativo;
      if (c[est] != null) c[est] += 1;
    }
    return c;
  }, [resources]);

  const nowValue = useMemo(() => {
    return dayjs(fechaSistema).hour(12).minute(0).second(0).toDate();
  }, [fechaSistema]);

  const esHoyDelSistema = (yymmdd) => yymmdd === fechaSistema;

  // ========= helpers habitación seleccionada =========
  const findHabByNumero = (numero) => {
    const num = String(numero);
    return (resources || []).find((x) => String(x.numero) === num) || null;
  };

  // ---- Selección de rango para crear algo nuevo ----
  const handleSelect = (arg) => {
    const start = dayjs(arg.start).format("YYYY-MM-DD");
    const end = dayjs(arg.end).format("YYYY-MM-DD");
    const habNumero = String(arg.resource.id);

    // ✅ BLOQUEAR selección si la habitación está bloqueada HOY (según estado_operativo)
    const h = findHabByNumero(habNumero);
    const est = h?.estado_operativo;

    if (est === "mantenimiento" || est === "fuera_servicio") {
      alert(`No se puede crear en esta habitación: está en estado '${est}' para la fecha operativa.`);
      return;
    }

    setSlotInfo({
      habNumero,
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
        alert("El registro Walk-In solo se permite para el día operativo actual.");
        return;
      }
      navigate(`/walkin/nuevo?hab=${habNumero}&desde=${start}&hasta=${end}`);
    } else if (accion === "reserva") {
      navigate(`/reservas/nueva?hab=${habNumero}&desde=${start}&hasta=${end}`);
    } else if (accion === "bloqueo_mantenimiento") {
      navigate(`/bloqueos/nuevo?tipo=mantenimiento&hab=${habNumero}&desde=${start}&hasta=${end}`);
    } else if (accion === "bloqueo_administrativo") {
      navigate(`/bloqueos/nuevo?tipo=administrativo&hab=${habNumero}&desde=${start}&hasta=${end}`);
    }

    setShowSlotModal(false);
  };

  // ---- Click sobre un evento (reserva o bloqueo) ----
  const handleEventClick = (info) => {
    const e = info.event;
    const start = dayjs(e.start).format("YYYY-MM-DD");
    const end = dayjs(e.end).format("YYYY-MM-DD");

    const kind = e.extendedProps?.kind;

    if (kind === "bloqueo") {
      setEventoSel({
        kind: "bloqueo",
        id: e.extendedProps.bloqueo_id,
        titulo: e.title,
        habitacion: e.extendedProps.habitacion_numero,
        start,
        end,
        tipo: e.extendedProps.tipo,
        motivo: e.extendedProps.motivo,
      });
      setShowEventModal(true);
      return;
    }

    setEventoSel({
      kind: "reserva",
      id: e.extendedProps?.reserva_id || e.id,
      titulo: e.title,
      habitacion: e.extendedProps?.habitacion_numero,
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

  // ---- editar reserva ----
  const abrirEditarReserva = async () => {
    if (!eventoSel || eventoSel.kind !== "reserva") return;
    setEditError("");
    setEditLoading(true);

    try {
      const r = await axios.get(`${API}/api/reservas/${eventoSel.id}`, {
        headers: getAuthHeaders(),
      });

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
    if (!eventoSel || eventoSel.kind !== "reserva") return;
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
        `${API}/api/reservas/${eventoSel.id}`,
        {
          fecha_inicio: editDesde,
          fecha_fin: editHasta,
          notas: editNotas?.trim() || null,
        },
        { headers: getAuthHeaders() }
      );

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

  // ---- reglas de negocio para botones (solo reservas) ----
  const puedeCheckIn = (() => {
    if (!eventoSel || eventoSel.kind !== "reserva") return false;
    if (eventoSel.estado !== "reservada") return false;
    const hoy = dayjs(fechaSistema);
    const inicio = dayjs(eventoSel.start);
    const fin = dayjs(eventoSel.end);
    return !hoy.isBefore(inicio, "day") && hoy.isBefore(fin, "day");
  })();

  const puedeCancelar = eventoSel?.kind === "reserva" && eventoSel?.estado === "reservada";

  const puedeCheckout = (() => {
    if (!eventoSel || eventoSel.kind !== "reserva") return false;
    if (eventoSel.estado !== "ocupada") return false;
    const hoy = dayjs(fechaSistema);
    const inicio = dayjs(eventoSel.start);
    return !hoy.isBefore(inicio.add(1, "day"), "day");
  })();

  // ---- acciones reservas ----
  const cancelarReserva = async () => {
    if (!eventoSel || eventoSel.kind !== "reserva") return;
    if (!window.confirm("¿Seguro que deseas cancelar esta reserva?")) return;

    try {
      await axios.delete(`${API}/api/reservas/${eventoSel.id}`, {
        headers: getAuthHeaders(),
      });
      await cargarRack();
      setShowEventModal(false);
    } catch (e) {
      console.error("Error cancelando reserva:", e);
      alert(e?.response?.data?.message || "No se pudo cancelar la reserva.");
    }
  };

  const irCheckIn = () => {
    if (!eventoSel || eventoSel.kind !== "reserva") return;
    navigate(`/checkin/${eventoSel.id}`);
  };

  // ✅ Usamos hacerCheckout para que no salga no-unused-vars
  const hacerCheckout = () => {
    if (!eventoSel || eventoSel.kind !== "reserva") return;
    navigate(`/reservas/${eventoSel.id}`);
  };

  const verRegistro = () => {
    if (!eventoSel) return;
    if (eventoSel.kind === "reserva") navigate(`/reservas/${eventoSel.id}`);
  };

 /* // ✅ FIX: define irAuditoriaCargos (antes no existía)
  const irAuditoriaCargos = () => {
    if (!eventoSel || eventoSel.kind !== "reserva") return;
    navigate(`/reservas/${eventoSel.id}/auditoria`);
  };*/

  // ---- acciones bloqueo ----
  const eliminarBloqueo = async () => {
    if (!eventoSel || eventoSel.kind !== "bloqueo") return;
    if (!window.confirm("¿Eliminar este bloqueo?")) return;

    try {
      await axios.delete(`${API}/api/bloqueos/${eventoSel.id}`, { headers: getAuthHeaders() });
      setShowEventModal(false);
      setEventoSel(null);
      await cargarRack();
    } catch (e) {
      alert(e?.response?.data?.message || "No se pudo eliminar el bloqueo.");
    }
  };

  // ==========================
  // ✅ Cambiar estado habitación (manual)
  // ==========================
  const abrirModalEstado = (resource) => {
    const ep = resource?.extendedProps || {};
    setHabSel({
      dbId: ep.dbId,
      numero: ep.numero,
      tipo: ep.tipo,
      estado_operativo: ep.estado,
      estado_base: ep.estado_base,
    });
    // por defecto dejamos el estado OPERATIVO, pero el PUT cambia el estado_base en DB
    setNuevoEstado(ep.estado_base || ep.estado || "");
    setEstadoError("");
    setShowEstadoModal(true);
  };

  const confirmarCambioEstado = async () => {
    if (!habSel?.dbId || !nuevoEstado) return;

    try {
      setEstadoLoading(true);
      setEstadoError("");

      await axios.put(
        `${API}/api/habitaciones/${habSel.dbId}/estado`,
        { estado: nuevoEstado },
        { headers: getAuthHeaders() }
      );

      setShowEstadoModal(false);
      setHabSel(null);
      setNuevoEstado("");
      await cargarRack();
    } catch (e) {
      setEstadoError(e?.response?.data?.message || "No se pudo cambiar el estado.");
    } finally {
      setEstadoLoading(false);
    }
  };

  return (
    <div style={{ padding: 10 }}>
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <div>
          <h2 className="mb-0"> Rack Interactivo de Habitaciones</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Estado y filtros calculados por <b>fecha operativa</b> (Zeus).
          </div>
        </div>

        <div className="d-flex align-items-center gap-2 flex-wrap">
          <span className="badge bg-secondary">Fecha operativa del hotel: {fechaSistema}</span>
          <Button variant="outline-secondary" size="sm" onClick={cargarRack}>
            ↻ Refrescar
          </Button>
        </div>
      </div>

      {/* ✅ mini dashboard conteos (HOY) */}
      <div className="d-flex gap-2 flex-wrap mb-2">
        <Badge bg="dark">Total: {conteos.total}</Badge>
        <Badge bg="success">Disponibles: {conteos.disponible}</Badge>
        <Badge bg="info">Reservadas: {conteos.reservada}</Badge>
        <Badge bg="danger">Ocupadas: {conteos.ocupada}</Badge>
        <Badge bg="warning" text="dark">
          Mantenimiento: {conteos.mantenimiento}
        </Badge>
        <Badge bg="secondary">Fuera servicio: {conteos.fuera_servicio}</Badge>
      </div>

      {/* ✅ filtros tipo Zeus */}
      <div className="card shadow-sm mb-2">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end">
            <div className="col-md-3">
              <Form.Label className="mb-1">Estado (HOY)</Form.Label>
              <Form.Select value={fEstado} onChange={(e) => setFEstado(e.target.value)}>
                <option value="todas">Todas</option>
                <option value="disponible">Disponible</option>
                <option value="reservada">Reservada</option>
                <option value="ocupada">Ocupada</option>
                <option value="mantenimiento">Mantenimiento</option>
                <option value="fuera_servicio">Fuera de servicio</option>
              </Form.Select>
            </div>

            <div className="col-md-3">
              <Form.Label className="mb-1">Tipo</Form.Label>
              <Form.Select value={fTipo} onChange={(e) => setFTipo(e.target.value)}>
                <option value="todas">Todos</option>
                {tiposDisponibles.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Form.Select>
            </div>

            <div className="col-md-4">
              <Form.Label className="mb-1">Buscar por número</Form.Label>
              <Form.Control value={fQ} onChange={(e) => setFQ(e.target.value)} placeholder="Ej: 101" />
            </div>

            <div className="col-md-2">
              <Button
                variant="primary"
                className="w-100"
                onClick={() => {
                  // filtros ya son reactivos; esto solo refresca data
                  cargarRack();
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>

          <div className="text-muted mt-2" style={{ fontSize: 12 }}>
            Tip: si una habitación está en <b>mantenimiento</b> o <b>fuera de servicio</b> para la fecha operativa,
            no te dejará crear reservas/walk-in en esa fila.
          </div>
        </div>
      </div>

      <FullCalendar
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
        locale="es"
        initialView="resourceTimelineWeek"
        initialDate={fechaSistema}
        nowIndicator={true}
        now={() => nowValue}
        height="78vh"
        resourceAreaWidth="300px"
        resources={resourcesFiltradas}
        events={events}
        selectable={true}
        selectMirror={true}
        select={handleSelect}
        eventClick={handleEventClick}
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
        resourceLabelContent={(arg) => {
          const ep = arg.resource.extendedProps || {};
          const est = ep.estado || "—";
          const estBase = ep.estado_base || "—";

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{arg.resource.title}</div>

              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <Badge bg={badgeVariant(est)} text={est === "mantenimiento" ? "dark" : undefined}>
                  {est}
                </Badge>

                <Button
                  size="sm"
                  variant="outline-secondary"
                  style={{ padding: "2px 6px", fontSize: 12 }}
                  onClick={() => abrirModalEstado(arg.resource)}
                  title="Cambia el estado base guardado en la habitación"
                >
                  Cambiar
                </Button>

                {(est === "mantenimiento" || est === "fuera_servicio") && (
                  <span style={{ fontSize: 11, color: "#6b7280" }}>(bloqueada)</span>
                )}
              </div>

              <div style={{ fontSize: 11, color: "#6b7280" }}>
                Base: <b>{estBase}</b>
              </div>
            </div>
          );
        }}
        eventContent={(info) => (
          <div style={{ fontSize: 12, padding: 2, fontWeight: 600 }}>{info.event.title}</div>
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
            <Form.Label className="mt-2">Seleccione el elemento a crear</Form.Label>

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
            <Form.Control type="date" value={editDesde} onChange={(e) => setEditDesde(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Salida</Form.Label>
            <Form.Control type="date" value={editHasta} onChange={(e) => setEditHasta(e.target.value)} />
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

          {editError && <div className="alert alert-danger py-2 mt-2 mb-0">{editError}</div>}
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

      {/* Modal de acciones sobre el evento (reserva / bloqueo) */}
      <Modal show={showEventModal} onHide={handleCloseEventModal} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {eventoSel?.kind === "bloqueo" ? "Bloqueo" : "Reserva"} #{eventoSel?.id}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <p>
            <strong>Habitación:</strong> {eventoSel?.habitacion}
          </p>
          <p>
            <strong>Rango:</strong> {eventoSel?.start} → {eventoSel?.end}
          </p>

          {eventoSel?.kind === "bloqueo" ? (
            <>
              <p>
                <strong>Tipo:</strong> {eventoSel?.tipo}
              </p>
              {eventoSel?.motivo ? (
                <p>
                  <strong>Motivo:</strong> {eventoSel?.motivo}
                </p>
              ) : null}

              <hr />
              <div className="d-flex flex-column gap-2">
                <Button variant="outline-danger" size="sm" onClick={eliminarBloqueo}>
                  Eliminar bloqueo
                </Button>
              </div>
            </>
          ) : (
            <>
              <p>
                <strong>Huésped:</strong> {eventoSel?.titulo}
              </p>
              <p>
                <strong>Estado:</strong> {eventoSel?.estado}
              </p>

              <hr />

              <p>Acciones disponibles:</p>
              <div className="d-flex flex-column gap-2">
                <Button variant="outline-secondary" size="sm" onClick={verRegistro}>
                  Ver registro / estado de cuenta
                </Button>

                {eventoSel?.estado === "reservada" && (
                  <Button variant="outline-warning" size="sm" onClick={abrirEditarReserva} disabled={editLoading}>
                    Editar reserva
                  </Button>
                )}

                {eventoSel?.estado === "reservada" && (
                  <Button variant="outline-primary" size="sm" disabled={!puedeCheckIn} onClick={irCheckIn}>
                    Check-In
                  </Button>
                )}

                {eventoSel?.estado === "ocupada" && (
                  <Button variant="outline-dark" size="sm" onClick={() => navigate(`/reservas/${eventoSel.id}/cargos`)}>
                    Cargos
                   </Button>
                )}

                {/* ✅ usamos hacerCheckout para que no salga el warning */}
                {eventoSel?.estado === "ocupada" && (
                  <Button variant="outline-success" size="sm" disabled={!puedeCheckout} onClick={hacerCheckout}>
                    Ir a check-out / facturar
                  </Button>
                )}

                <Button variant="outline-danger" size="sm" onClick={cancelarReserva} disabled={!puedeCancelar}>
                  Cancelar reserva
                </Button>
              </div>

              {eventoSel?.estado === "reservada" && !puedeCheckIn && (
                <p className="mt-3 text-muted" style={{ fontSize: "0.9rem" }}>
                  El check-in solo se permite cuando la fecha operativa del hotel está dentro del rango de la reserva.
                </p>
              )}

              {eventoSel?.estado === "ocupada" && !puedeCheckout && (
                <p className="mt-3 text-muted" style={{ fontSize: "0.9rem" }}>
                  El check-out solo se permite a partir del día siguiente al check-in según la fecha operativa del hotel.
                </p>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseEventModal}>
            Cerrar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* ✅ Modal cambiar estado habitación */}
      <Modal show={showEstadoModal} onHide={() => setShowEstadoModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Cambiar estado de habitación</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-2">
            <b>Habitación:</b> {habSel?.numero} — {habSel?.tipo}
          </div>

          <div className="mb-2">
            <b>Estado HOY:</b>{" "}
            <Badge
              bg={badgeVariant(habSel?.estado_operativo)}
              text={habSel?.estado_operativo === "mantenimiento" ? "dark" : undefined}
            >
              {habSel?.estado_operativo}
            </Badge>
          </div>

          <div className="mb-2">
            <b>Estado base (DB):</b>{" "}
            <Badge
              bg={badgeVariant(habSel?.estado_base)}
              text={habSel?.estado_base === "mantenimiento" ? "dark" : undefined}
            >
              {habSel?.estado_base}
            </Badge>
          </div>

          <Form.Group className="mt-3">
            <Form.Label>Nuevo estado base</Form.Label>
            <Form.Select value={nuevoEstado} onChange={(e) => setNuevoEstado(e.target.value)}>
              <option value="disponible">disponible</option>
              <option value="mantenimiento">mantenimiento</option>
              <option value="fuera_servicio">fuera_servicio</option>

              {/* opcional */}
              <option value="reservada">reservada</option>
              <option value="ocupada">ocupada</option>
            </Form.Select>

            <div className="text-muted mt-2" style={{ fontSize: 12 }}>
              Nota: el rack muestra <b>Estado HOY</b> calculado por reservas/bloqueos según <b>fecha operativa</b>.
              Este cambio modifica el estado guardado en la habitación (base).
            </div>
          </Form.Group>

          {estadoError && <div className="alert alert-danger py-2 mt-3 mb-0">{estadoError}</div>}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowEstadoModal(false)} disabled={estadoLoading}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={confirmarCambioEstado} disabled={estadoLoading}>
            {estadoLoading ? "Guardando..." : "Guardar"}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
