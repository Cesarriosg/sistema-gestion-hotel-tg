// src/pages/CalendarioRack.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import resourceTimelinePlugin from "@fullcalendar/resource-timeline";
import interactionPlugin from "@fullcalendar/interaction";
import dayjs from "dayjs";
import "dayjs/locale/es";
import { useNavigate } from "react-router-dom";
import { Modal, Button, Form, Badge, Nav, Row, Col, Spinner } from "react-bootstrap";
import {io} from "socket.io-client";
import "./CalendarioRack.css"
import reservasService     from "../services/reservasService";
import pagosService        from "../services/pagosService";
import habitacionesService from "../services/habitacionesService";
import bloqueosService     from "../services/bloqueosService";
import huespedesService    from "../services/huespedesService";
import hotelService        from "../services/hotelService";

dayjs.locale("es");

const socket = io(process.env.REACT_APP_API_URL || "http://localhost:4000", { transports: ["websocket"] });



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
  const H = dayjs(hoy).startOf("day");
  const I = dayjs(inicio).startOf("day");
  const F = dayjs(fin).startOf("day");
  return (H.isSame(I) || H.isAfter(I)) && H.isBefore(F)
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
  const [fechaSistema, setFechaSistema] = useState(null);
  const [loadingFecha, setLoadingFecha] = useState(true);

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
  const [editHabNumero, setEditHabNumero] = useState("");
  const [editTabActiva, setEditTabActiva] = useState("reserva");
  const [editTitular, setEditTitular] = useState(null);
  const [editHabitaciones, setEditHabitaciones] = useState([]);


  // ✅ Modal cambiar estado habitación
  const [showEstadoModal, setShowEstadoModal] = useState(false);
  // Mini-form depósito en modal de reserva
  const [showDeposito,   setShowDeposito]   = useState(false);
  const [depMonto,       setDepMonto]       = useState("");
  const [depMetodo,      setDepMetodo]      = useState("efectivo");
  const [depRef,         setDepRef]         = useState("");
  const [depGuardando,   setDepGuardando]   = useState(false);
  const [depMsg,         setDepMsg]         = useState("");
  const [habSel, setHabSel] = useState(null); // {dbId, numero, tipo, estado_operativo, estado_base}
  const [nuevoEstado, setNuevoEstado] = useState("");
  const [estadoLoading, setEstadoLoading] = useState(false);
  const [estadoError, setEstadoError] = useState("");

  const rackLoadingRef = useRef(false);
  const calendarRef = useRef(null);
  // ✅ FIX: ref para que los closures de socket/visibilitychange siempre lean
  //         la fecha actualizada, sin importar cuándo se registraron.
  const fechaSistemaRef = useRef(null);

const cargarRackSeguro = async () => {
  if (rackLoadingRef.current) return;
  rackLoadingRef.current = true;
  try {
    await cargarRack();
  } finally {
    rackLoadingRef.current = false;
  }
};

  const navigate = useNavigate();
  const [editBuscando, setEditBuscando] = useState(false);

  // ── Buscar huésped por documento (llamado explícitamente) ────────────────
  const buscarHuespedParaEditar = async () => {
    if (!editTitular) return;
    const td  = (editTitular.tipo_documento || "").trim().toUpperCase();
    const doc = (editTitular.documento || "").trim();
    if (!td || !doc) return;

    setEditBuscando(true);
    try {
      const r = await huespedesService.buscar({ tipo_documento: td, documento: doc });
      // Encontrado → autocompletar
      setEditTitular(prev => ({
        ...prev,
        huesped_id:       r.data.id,
        nombres:          r.data.nombres          || "",
        primer_apellido:  r.data.primer_apellido  || "",
        segundo_apellido: r.data.segundo_apellido || "",
        telefono:         r.data.telefono         || "",
        email:            r.data.email            || "",
      }));
    } catch {
      // 404 = no existe → limpiar campos para entrada manual
      setEditTitular(prev => ({
        ...prev,
        huesped_id:       null,
        nombres:          "",
        primer_apellido:  "",
        segundo_apellido: "",
        telefono:         "",
        email:            "",
      }));
    } finally {
      setEditBuscando(false);
    }
  };

useEffect(() => {
  // ✅ FIX: el handler lee fechaSistemaRef en el momento que se ejecuta,
  //         no el valor que tenía cuando se registró el listener.
  const handler = () => {
    if (fechaSistemaRef.current) cargarRackSeguro();
  };

  socket.on("rack:update", handler);

  return () => {
    socket.off("rack:update", handler);
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

useEffect(() => {
  // ✅ FIX: mantener ref sincronizado para que socket/visibilitychange lo lean
  fechaSistemaRef.current = fechaSistema;
  if (fechaSistema) cargarRackSeguro();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [fechaSistema]);

useEffect(() => {
  // ✅ FIX: guardar cargarRackSeguro en ref para que visibilitychange
  //         siempre use la versión actualizada con fechaSistema correcto.
  const onVis = () => {
    if (document.visibilityState === "visible" && fechaSistemaRef.current) {
      cargarRackSeguro();
    }
  };
  document.addEventListener("visibilitychange", onVis);
  return () => document.removeEventListener("visibilitychange", onVis);
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(()=>{
  if (!fechaSistema) return;
  const api = calendarRef.current?.getApi?.();
  if (!api) return;
  
  api.gotoDate(fechaSistema);
}, [fechaSistema]);


  const obtenerFechaSistema = async () => {
  try {
    setLoadingFecha(true);
    const r = await hotelService.fechaSistema();

    const f = dayjs(r.data.fecha).format("YYYY-MM-DD");
    setFechaSistema(f);
  } catch (e) {
    console.error("Error obteniendo fecha del sistema:", e);
    // fallback (opcional): si falla backend, usa la del PC para no romper
    setFechaSistema(dayjs().format("YYYY-MM-DD"));
  } finally {
    setLoadingFecha(false);
  }
};

  const cargarRack = async () => {
    // ✅ FIX: leer el ref, no el closure. Así funciona desde socket y visibilitychange.
    const fechaActual = fechaSistemaRef.current;
    if (!fechaActual) return; // aún no tenemos fecha, no calcular

    try {
      const [habsR, reservasR] = await Promise.all([
        habitacionesService.listar(),
        reservasService.calendario(),
      ]);

      // bloqueos pueden fallar si no está montado; no rompemos todo
      let bloqueos = [];
      try {
        const bloqsR = await bloqueosService.calendario();
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
          fechaSistema: fechaActual,   // ✅ usa ref, no el closure
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
      const eventosReservas = reservas.map((r) => {
  const startISO = buildReservaStart(r.fecha_inicio);
  const endISO = buildReservaEnd(r.fecha_fin, startISO);

  return {
    id: `R-${r.id}`,
    resourceId: String(r.habitacion_numero),
    title: r.huesped_nombre,
    start: startISO,
    end: endISO,
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
  };
});

      // eventos bloqueos
      const eventosBloqueos = (bloqueos || []).map((b) => {
  const startISO = buildBloqueoStart(b.fecha_inicio);
  const endISO = buildBloqueoEnd(b.fecha_fin, startISO);

  return {
    id: `B-${b.id}`,
    resourceId: String(b.habitacion_numero),
    title: b.tipo === "mantenimiento" ? " MANTENIMIENTO" : " BLOQUEO ADM",
    start: startISO,
    end: endISO,
    display: "block",
    color: b.tipo === "mantenimiento" ? "#f59e0b" : "#111827",
    extendedProps: {
      kind: "bloqueo",
      bloqueo_id: b.id,
      tipo: b.tipo,
      motivo: b.motivo || "",
      habitacion_numero: b.habitacion_numero,
    },
  };
});
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

 /* const nowValue = useMemo(() => {
    return dayjs(fechaSistema).hour(12).minute(0).second(0).toDate();
  }, [fechaSistema]);*/

  const esHoyDelSistema = (yymmdd) => yymmdd === fechaSistema;

  // Extraer YYYY-MM-DD sin parsear timezone (evita desfase UTC-5 en Colombia)
  const toDateStr = (fecha) => String(fecha || "").slice(0, 10);

  const buildReservaStart = (fechaInicio) =>
    `${toDateStr(fechaInicio)}T15:00:00`;

const buildReservaEnd = (fechaFin, startISO) => {
  let endISO = `${toDateStr(fechaFin)}T11:00:00`;

  if (!dayjs(endISO).isAfter(dayjs(startISO))) {
    endISO = `${dayjs(startISO).add(1, "day").format("YYYY-MM-DD")}T11:00:00`;
  }

  return endISO;
};

const buildBloqueoStart = (fechaInicio) =>
  `${toDateStr(fechaInicio)}T00:00:00`;

const buildBloqueoEnd = (fechaFin, startISO) => {
  let endISO = `${toDateStr(fechaFin)}T00:00:00`;

  // ✅ si end == start, al menos 1 día para que se vea
  if (!dayjs(endISO).isAfter(dayjs(startISO))) {
    endISO = `${dayjs(startISO).add(1, "day").format("YYYY-MM-DD")}T00:00:00`;
  }
  return endISO;
};

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
    setShowDeposito(false);
    setDepMonto(""); setDepMetodo("efectivo"); setDepRef(""); setDepMsg("");
    setShowEventModal(false);
    setEventoSel(null);
  };

  // ---- editar reserva ----
  const abrirEditarReserva = async () => {
    if (!eventoSel || eventoSel.kind !== "reserva") return;
    setEditError("");
    setEditTabActiva("reserva");
    setEditTitular(null);
    setEditHabitaciones([]);
    setEditLoading(true);

    try {
      // 1) Datos de la reserva
      const r = await reservasService.obtener(eventoSel.id);
      setEditDesde(dayjs(r.data.fecha_inicio).format("YYYY-MM-DD"));
      setEditHasta(dayjs(r.data.fecha_fin).format("YYYY-MM-DD"));
      setEditNotas(r.data.notas || "");
      setEditHabNumero(String(r.data.habitacion_numero || eventoSel.habitacion || ""));

      // 2) Datos del titular
      try {
        const ci = await reservasService.datosCheckin(eventoSel.id);
        setEditTitular({
          huesped_id:       ci.data.huesped_id       || null,
          tipo_documento:   ci.data.tipo_documento   || "",
          documento:        ci.data.documento        || "",
          nombres:          ci.data.nombres          || "",
          primer_apellido:  ci.data.primer_apellido  || "",
          segundo_apellido: ci.data.segundo_apellido || "",
          telefono:         ci.data.telefono         || "",
          email:            ci.data.email            || "",
        });
      } catch {
        setEditTitular(null);
      }

      // 3) Habitaciones disponibles (solo si reservada)
      if (eventoSel.estado === "reservada") {
        try {
          const dispR = await reservasService.habitacionesDisp({ desde: dayjs(r.data.fecha_inicio).format("YYYY-MM-DD"), hasta: dayjs(r.data.fecha_fin).format("YYYY-MM-DD") });
          const lista = dispR.data || [];
          const habActual = String(r.data.habitacion_numero || eventoSel.habitacion || "");
          if (!lista.some(h => String(h.numero) === habActual)) {
            lista.unshift({ numero: habActual, tipo: r.data.habitacion_tipo || "" });
          }
          setEditHabitaciones(lista);
        } catch {
          setEditHabitaciones([{ numero: String(r.data.habitacion_numero || ""), tipo: r.data.habitacion_tipo || "" }]);
        }
      }

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
      setEditTabActiva("reserva");
      return;
    }
    if (!dayjs(editHasta).isAfter(dayjs(editDesde))) {
      setEditError("La fecha de salida debe ser posterior a la fecha de ingreso.");
      setEditTabActiva("reserva");
      return;
    }

    // ✅ Validar titular antes de llamar al backend
    if (editTitular?.huesped_id && eventoSel.estado !== "finalizada") {
      if (!editTitular.nombres?.trim()) {
        setEditError("El campo 'Nombres' del titular es obligatorio.");
        setEditTabActiva("huesped");
        return;
      }
      if (!editTitular.primer_apellido?.trim()) {
        setEditError("El campo 'Primer apellido' del titular es obligatorio.");
        setEditTabActiva("huesped");
        return;
      }
    }

    try {
      setEditLoading(true);

      // 1) Actualizar reserva: fechas, habitación, notas
      await reservasService.actualizar(eventoSel.id, {
        fecha_inicio:      editDesde,
        fecha_fin:         editHasta,
        notas:             editNotas,
        habitacion_numero: editHabNumero || undefined,
      });

      // 2) Actualizar titular — si tiene ID actualiza huésped existente,
      //    si no tiene ID pero tiene nombres, crea el huésped y lo vincula
      if (editTitular && eventoSel.estado !== "finalizada") {
        const body = {
          nombres:          editTitular.nombres?.trim()          || "",
          primer_apellido:  editTitular.primer_apellido?.trim()  || "",
          segundo_apellido: editTitular.segundo_apellido?.trim() || null,
          tipo_documento:   editTitular.tipo_documento           || null,
          documento:        editTitular.documento?.trim()        || null,
          telefono:         editTitular.telefono?.trim()         || null,
          email:            editTitular.email?.trim()            || null,
        };

        if (editTitular.huesped_id) {
          // Huésped ya existe → actualizar
          await huespedesService.actualizar(editTitular.huesped_id, body);
        }
      }

      setShowEditModal(false);
      setShowEventModal(false);
      setEventoSel(null);
      await cargarRack();
    } catch (e) {
      const status = e?.response?.status;
      const msg    = e?.response?.data?.message;

      if (status === 409) {
        setEditTabActiva("reserva");
        setEditError(msg || "Choque de fechas: la habitación ya tiene una reserva en ese rango.");
        return;
      }
      // Si el error viene del PUT de huésped, llevar al tab correcto
      if (status === 400) {
        setEditTabActiva("huesped");
      }
      setEditError(msg || "No se pudo actualizar. Verifica los datos e intenta de nuevo.");
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
      await reservasService.cancelar(eventoSel.id, {});
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
    navigate(`/facturacion/${eventoSel.id}`);
  };

  const verRegistro = () => {
    if (!eventoSel) return;
    if (eventoSel.kind === "reserva") navigate(`/reservas/${eventoSel.id}`);
  };

  const registrarDeposito = async () => {
    setDepMsg("");
    const monto = Number(depMonto);
    if (!monto || monto <= 0) return setDepMsg("El monto debe ser mayor a 0.");
    setDepGuardando(true);
    try {
      await pagosService.registrar({ reserva_id: eventoSel.id, tipo: "deposito", metodo: depMetodo, monto, referencia: depRef.trim() || null });
      setDepMsg("✓ Depósito registrado correctamente.");
      setDepMonto(""); setDepRef("");
      setTimeout(() => { setShowDeposito(false); setDepMsg(""); }, 1800);
    } catch(e) {
      setDepMsg(e?.response?.data?.message || "Error al registrar el depósito.");
    } finally { setDepGuardando(false); }
  };

  // ---- acciones bloqueo ----
  const eliminarBloqueo = async () => {
    if (!eventoSel || eventoSel.kind !== "bloqueo") return;
    if (!window.confirm("¿Eliminar este bloqueo?")) return;

    try {
      await bloqueosService.eliminar(eventoSel.id);
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

      await habitacionesService.cambiarEstado(habSel.dbId, { estado: nuevoEstado });

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
          <Button variant="outline-secondary" size="sm" onClick={cargarRackSeguro}>
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
                  cargarRackSeguro();
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

      {loadingFecha || !fechaSistema ? (
        <div className="card shadow-sm p-4">
          <div className="text-muted">Cargando fecha </div>
          </div>
      ) : (

      <FullCalendar
        key = {fechaSistema}
        plugins={[resourceTimelinePlugin, interactionPlugin]}
        schedulerLicenseKey="GPL-My-Project-Is-Open-Source"
        locale="es"
        initialView="resourceTimelineWeek"
        initialDate={fechaSistema}
        ref={calendarRef}
        nowIndicator={true}
        now={() => dayjs(fechaSistema).hour(12).minute(0).second(0).toDate()}
        height="78vh"
        resourceAreaWidth="300px"
        resources={resourcesFiltradas}
        events={events}
        selectable={true}
        selectMirror={true}
        select={handleSelect}
        eventClick={handleEventClick}
        unselectAuto={true}
        slotDuration="12:00:00"
        slotLabelFormat={[{ weekday: "short", month: "numeric", day: "numeric" },
          {hour: "2-digit"},
        ]}
        slotLabelContent={(arg)=>{
          if (arg.level===0) return arg.text;
        }}
        headerToolbar={{
          left: "HoySistema prev next",
          center: "title",
          right: "resourceTimelineDay,resourceTimelineWeek,resourceTimelineMonth",
        }}
        customButtons={{
          hoySistema:{
            text: "Hoy",
            click: () => {
              const api = calendarRef.current?.getApi?.();
              if (api) api.gotoDate(fechaSistema);
            }
          }
        }}
        views={{
          resourceTimelineDay: { slotDuration: "12:00:00" },
          resourceTimelineWeek: { slotDuration: "12:00:00" },
          resourceTimelineMonth: { slotDuration:"12:00:00" }, //{ days: 1 } 
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
      />)}

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
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            Editar reserva #{eventoSel?.id}{" "}
            <Badge bg={eventoSel?.estado === "ocupada" ? "success" : "primary"} className="ms-2" style={{ fontSize: 13 }}>
              {eventoSel?.estado}
            </Badge>
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {editLoading && !editDesde ? (
            <div className="d-flex justify-content-center py-4">
              <Spinner animation="border" />
            </div>
          ) : (
            <>
              {/* Pestañas */}
              <Nav variant="tabs" className="mb-3" activeKey={editTabActiva} onSelect={k => setEditTabActiva(k)}>
                <Nav.Item>
                  <Nav.Link eventKey="reserva">📅 Reserva</Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="huesped">👤 Titular</Nav.Link>
                </Nav.Item>
              </Nav>

              {/* ── Tab: Reserva ── */}
              {editTabActiva === "reserva" && (
                <div>
                  {eventoSel?.estado === "ocupada" && (
                    <div className="alert alert-info py-2 mb-3" style={{ fontSize: 13 }}>
                      La reserva está <b>ocupada</b>. Solo se pueden editar las notas internas.
                    </div>
                  )}

                  <Row className="mb-3">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Ingreso</Form.Label>
                        <Form.Control
                          type="date"
                          value={editDesde}
                          disabled={eventoSel?.estado === "ocupada"}
                          onChange={(e) => setEditDesde(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Salida</Form.Label>
                        <Form.Control
                          type="date"
                          value={editHasta}
                          disabled={eventoSel?.estado === "ocupada"}
                          onChange={(e) => setEditHasta(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Cambio de habitación — solo reservadas */}
                  {eventoSel?.estado === "reservada" && editHabitaciones.length > 1 && (
                    <Form.Group className="mb-3">
                      <Form.Label>Habitación</Form.Label>
                      <Form.Select
                        value={editHabNumero}
                        onChange={(e) => setEditHabNumero(e.target.value)}
                      >
                        {editHabitaciones.map(h => (
                          <option key={h.numero} value={String(h.numero)}>
                            Hab. {h.numero} — {h.tipo}
                            {String(h.numero) === String(eventoSel?.habitacion) ? " (actual)" : ""}
                          </option>
                        ))}
                      </Form.Select>
                      <Form.Text className="text-muted">
                        Habitación actual + disponibles para este rango de fechas.
                      </Form.Text>
                    </Form.Group>
                  )}

                  <Form.Group>
                    <Form.Label>
                      Notas internas{" "}
                      <small className="text-muted">(solo visibles para el personal)</small>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={editNotas}
                      onChange={(e) => setEditNotas(e.target.value)}
                      placeholder="Ej: Llegará tarde, requiere cama adicional, alergias..."
                    />
                  </Form.Group>
                </div>
              )}

              {/* ── Tab: Titular ── */}
              {editTabActiva === "huesped" && (
                <div>
                  {!editTitular ? (
                    <div className="text-muted py-2">No se encontraron datos del titular.</div>
                  ) : (
                    <>
                      {!editTitular.huesped_id && (
                        <div className="alert alert-info py-2 mb-3" style={{ fontSize: 13 }}>
                          El titular aún no tiene documento registrado. Los datos se confirmarán en el Check-In.
                        </div>
                      )}

                      <Row className="g-2">
                        <Col md={3}>
                          <Form.Label>Tipo documento</Form.Label>
                          <Form.Select
                            value={editTitular.tipo_documento}
                            onChange={e => setEditTitular(prev => ({ ...prev, tipo_documento: e.target.value }))}
                          >
                            <option value="">Seleccione...</option>
                            {["CC","CE","PA","TI","NIT"].map(t => <option key={t} value={t}>{t}</option>)}
                          </Form.Select>
                        </Col>
                        <Col md={6}>
                          <Form.Label>Documento</Form.Label>
                          <Form.Control
                            value={editTitular.documento}
                            onChange={e => setEditTitular(prev => ({ ...prev, documento: e.target.value }))}
                            onKeyDown={e => e.key === "Enter" && buscarHuespedParaEditar()}
                            placeholder="Documento y Enter para buscar..."
                          />
                        </Col>
                        <Col md={3} className="d-flex align-items-end">
                          <Button
                            variant="outline-secondary"
                            size="sm"
                            className="w-100"
                            onClick={buscarHuespedParaEditar}
                            disabled={editBuscando || !editTitular.tipo_documento || !editTitular.documento}
                          >
                            {editBuscando ? <Spinner animation="border" size="sm" /> : "🔍 Buscar"}
                          </Button>
                        </Col>
                        {editTitular.huesped_id && (
                          <Col md={12}>
                            <small className="text-success">✅ Huésped encontrado — datos cargados.</small>
                          </Col>
                        )}

                        <Col md={4}>
                          <Form.Label>Nombres *</Form.Label>
                          <Form.Control
                            value={editTitular.nombres}
                            onChange={e => setEditTitular(prev => ({ ...prev, nombres: e.target.value }))}
                          />
                        </Col>
                        <Col md={4}>
                          <Form.Label>Primer apellido *</Form.Label>
                          <Form.Control
                            value={editTitular.primer_apellido}
                            onChange={e => setEditTitular(prev => ({ ...prev, primer_apellido: e.target.value }))}
                          />
                        </Col>
                        <Col md={4}>
                          <Form.Label>Segundo apellido</Form.Label>
                          <Form.Control
                            value={editTitular.segundo_apellido}
                            onChange={e => setEditTitular(prev => ({ ...prev, segundo_apellido: e.target.value }))}
                          />
                        </Col>

                        <Col md={6}>
                          <Form.Label>Teléfono</Form.Label>
                          <Form.Control
                            value={editTitular.telefono}
                            onChange={e => setEditTitular(prev => ({ ...prev, telefono: e.target.value }))}
                            placeholder="Ej: 3001234567"
                          />
                        </Col>
                        <Col md={6}>
                          <Form.Label>Email</Form.Label>
                          <Form.Control
                            value={editTitular.email}
                            onChange={e => setEditTitular(prev => ({ ...prev, email: e.target.value }))}
                            placeholder="correo@..."
                          />
                        </Col>
                      </Row>

                      <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                        Nombre completo:{" "}
                        <b>
                          {[editTitular.nombres, editTitular.primer_apellido, editTitular.segundo_apellido]
                            .map(x => (x || "").trim()).filter(Boolean).join(" ") || "—"}
                        </b>
                      </div>
                    </>
                  )}
                </div>
              )}

              {editError && (
                <div className="alert alert-danger py-2 mt-3 mb-0">{editError}</div>
              )}
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)} disabled={editLoading}>
            Cancelar
          </Button>
          <Button variant="warning" onClick={guardarEdicionReserva} disabled={editLoading}>
            {editLoading ? <><Spinner animation="border" size="sm" className="me-2" />Guardando...</> : "Guardar cambios"}
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
                  <Button
                    variant="outline-success" size="sm"
                    onClick={() => { setShowDeposito(d => !d); setDepMsg(""); }}
                  >
                    {showDeposito ? "Cancelar depósito" : "Aplicar depósito"}
                  </Button>
                )}

                {showDeposito && eventoSel?.estado === "reservada" && (
                  <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 12, marginTop: 4 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#15803d" }}>Registrar depósito</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input
                          type="number" min="1" placeholder="Monto"
                          value={depMonto} onChange={e => setDepMonto(e.target.value)}
                          style={{ flex: 1, border: "1px solid #d1fae5", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}
                        />
                        <select
                          value={depMetodo} onChange={e => setDepMetodo(e.target.value)}
                          style={{ border: "1px solid #d1fae5", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}
                        >
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="tarjeta">Tarjeta</option>
                          <option value="nequi">Nequi</option>
                          <option value="daviplata">Daviplata</option>
                        </select>
                      </div>
                      <input
                        type="text" placeholder="Referencia (opcional)"
                        value={depRef} onChange={e => setDepRef(e.target.value)}
                        style={{ border: "1px solid #d1fae5", borderRadius: 6, padding: "5px 8px", fontSize: 13 }}
                      />
                      <button
                        onClick={registrarDeposito} disabled={depGuardando || !depMonto}
                        style={{ background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: depGuardando ? 0.7 : 1 }}
                      >
                        {depGuardando ? "Guardando..." : "Confirmar depósito"}
                      </button>
                      {depMsg && (
                        <div style={{ fontSize: 12, color: depMsg.startsWith("✓") ? "#15803d" : "#dc2626", fontWeight: 500 }}>
                          {depMsg}
                        </div>
                      )}
                    </div>
                  </div>
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