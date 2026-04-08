// src/pages/Administracion.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import dayjs from "dayjs";
import { Badge, Button, Form, Modal, Row, Col, Table, Alert, Spinner, Tab, Tabs } from "react-bootstrap";
import tarifasService      from "../services/tarifasService";
import habitacionesService from "../services/habitacionesService";
import serviciosService    from "../services/serviciosService";


const money = (v) =>
  Number(v || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

const TEMPORADAS = [
  { value: "base",     label: "Base" },
  { value: "alta",     label: "Alta" },
  { value: "especial", label: "Especial" },
];

// ─────────────────────────────────────────────────────────────────────────────
// TAB 1 — HABITACIONES
// ─────────────────────────────────────────────────────────────────────────────
function TabHabitaciones({ planes }) {
  const [habitaciones,  setHabitaciones]  = useState([]);
  const [tipos,         setTipos]         = useState([]);
  const [loading,       setLoading]       = useState(false);
  const [filtroTexto,   setFiltroTexto]   = useState("");
  const [filtroEstado,  setFiltroEstado]  = useState("todos");
  const [filtroActivas, setFiltroActivas] = useState("todas");
  const [edits,         setEdits]         = useState({});
  const [showCrear,     setShowCrear]     = useState(false);
  const [nuevoNumero,   setNuevoNumero]   = useState("");
  const [nuevoTipo,     setNuevoTipo]     = useState("");
  const [nuevaCap,      setNuevaCap]      = useState(2);
  const [guardando,     setGuardando]     = useState(false);
  // Notas por habitación
  const [showNotas,     setShowNotas]     = useState(false);
  const [notasHabId,    setNotasHabId]    = useState(null);
  const [notasHabNum,   setNotasHabNum]   = useState("");
  const [notasTexto,    setNotasTexto]    = useState("");
  const [guardandoNotas,setGuardandoNotas]= useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await habitacionesService.listar();
      const lista = Array.isArray(data) ? data : [];
      setHabitaciones(lista);
      const next = {};
      lista.forEach((h) => {
        next[h.id] = { saving: false };
      });
      setEdits(next);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const cargarTipos = useCallback(async () => {
    try {
      const { data } = await habitacionesService.tipos();
      setTipos(Array.isArray(data) ? data : []);
    } catch { setTipos([]); }
  }, []);

  useEffect(() => { cargar(); cargarTipos(); }, [cargar, cargarTipos]);

  const cambiarTipo   = async (id, tipo)   => { try { await habitacionesService.actualizar(id, { tipo }); await cargar(); } catch (e) { alert(e?.response?.data?.message || "Error al cambiar tipo.");   } };
  const cambiarEstado = async (id, estado) => { try { await habitacionesService.cambiarEstado(id, { estado }); await cargar(); } catch (e) { alert(e?.response?.data?.message || "Error al cambiar estado."); } };
  const toggleActivo  = async (id, activo) => { try { await habitacionesService.actualizar(id, { activo: !activo }); await cargar(); } catch (e) { alert(e?.response?.data?.message || "Error."); } };

  const abrirNotas = (h) => {
    setNotasHabId(h.id); setNotasHabNum(h.numero);
    setNotasTexto(h.notas || ""); setShowNotas(true);
  };
  const guardarNotas = async () => {
    setGuardandoNotas(true);
    try {
      await habitacionesService.actualizarNotas(notasHabId, notasTexto);
      setShowNotas(false); await cargar();
    } catch (e) { alert(e?.response?.data?.message || "Error al guardar notas."); }
    finally { setGuardandoNotas(false); }
  };

  const guardarPlanTarifa = async (habId) => {
    const row = edits[habId] || {};
    const plan   = String(row.plan || "").trim();
    const precio = Number(row.tarifa);
    if (!plan) return alert("Plan requerido.");
    if (isNaN(precio) || precio <= 0) return alert("Tarifa invalida.");
    try {
      setEdits((p) => ({ ...p, [habId]: { ...p[habId], saving: true } }));
      await habitacionesService.actualizar(habId, { plan, precio });
      await cargar();
    } catch (e) { alert(e?.response?.data?.message || "Error al guardar."); }
    finally { setEdits((p) => ({ ...p, [habId]: { ...p[habId], saving: false } })); }
  };

  const crearHabitacion = async () => {
    if (!nuevoNumero.trim() || !nuevoTipo) return alert("Numero y tipo son obligatorios.");
    try {
      setGuardando(true);
      await habitacionesService.crear({ numero: nuevoNumero.trim(), tipo: nuevoTipo, capacidad: Number(nuevaCap || 2) });
      setNuevoNumero(""); setNuevaCap(2); setShowCrear(false);
      await cargar();
    } catch (e) { alert(e?.response?.data?.message || "Error al crear."); }
    finally { setGuardando(false); }
  };

  const getBadge = (e) => ({
    disponible:    <Badge bg="success">Disponible</Badge>,
    ocupada:       <Badge bg="danger">Ocupada</Badge>,
    reservada:     <Badge bg="info">Reservada</Badge>,
    mantenimiento: <Badge bg="warning" text="dark">Mantenimiento</Badge>,
    fuera_servicio:<Badge bg="secondary">Fuera servicio</Badge>,
  }[e] || <Badge bg="light" text="dark">{e || "—"}</Badge>);

  const lista = useMemo(() => habitaciones.filter((h) => {
    const pasaTxt = `${h.numero} ${h.tipo}`.toLowerCase().includes(filtroTexto.toLowerCase());
    const pasaEst = filtroEstado === "todos" || h.estado === filtroEstado;
    const pasaAct = filtroActivas === "todas" || (filtroActivas === "activas" ? h.activo : !h.activo);
    return pasaTxt && pasaEst && pasaAct;
  }), [habitaciones, filtroTexto, filtroEstado, filtroActivas]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-0" style={{ fontWeight: 700 }}>Habitaciones</h4>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Tipo y estado de cada habitación. El plan se asigna al crear la reserva, no a la habitación.
          </div>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-secondary" size="sm" onClick={cargar} disabled={loading}>Recargar</Button>
          <Button variant="primary" size="sm" onClick={() => setShowCrear(true)}>+ Crear habitacion</Button>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <input className="form-control" style={{ maxWidth: 200 }} placeholder="Buscar numero o tipo..."
          value={filtroTexto} onChange={(e) => setFiltroTexto(e.target.value)} />
        <select className="form-select" style={{ maxWidth: 170 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="todos">Todos los estados</option>
          <option value="disponible">Disponible</option>
          <option value="ocupada">Ocupada</option>
          <option value="reservada">Reservada</option>
          <option value="mantenimiento">Mantenimiento</option>
          <option value="fuera_servicio">Fuera de servicio</option>
        </select>
        <select className="form-select" style={{ maxWidth: 200 }} value={filtroActivas} onChange={(e) => setFiltroActivas(e.target.value)}>
          <option value="todas">Todas</option>
          <option value="activas">Solo activas</option>
          <option value="inactivas">Solo inactivas</option>
        </select>
      </div>

      {loading ? <div className="text-muted py-3">Cargando...</div> : (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead className="table-dark">
              <tr>
                <th>#</th><th>Número</th><th>Tipo</th>
                <th>Estado hoy</th><th>Estado base</th>
                <th>Activa</th><th>Notas</th><th>Cambiar estado base</th>
              </tr>
            </thead>
            <tbody>
              {lista.length === 0
                ? <tr><td colSpan={7} className="text-center text-muted">Sin resultados.</td></tr>
                : lista.map((h, i) => (
                    <tr key={h.id}>
                      <td className="text-muted">{i + 1}</td>
                      <td className="fw-semibold">{h.numero}</td>
                      <td>
                        <select className="form-select form-select-sm" value={h.tipo}
                          onChange={(e) => cambiarTipo(h.id, e.target.value)} style={{ minWidth: 130 }}>
                          {tipos.length > 0
                            ? tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre} ({t.codigo})</option>)
                            : <option value={h.tipo}>{h.tipo}</option>}
                        </select>
                      </td>
                      <td>{getBadge(h.estado_operativo)}</td>
                      <td>{getBadge(h.estado_base)}</td>
                      <td>
                        <span className="badge" style={{ background: h.activo ? "#16a34a" : "#6b7280", cursor: "pointer" }}
                          onClick={() => toggleActivo(h.id, h.activo)}>
                          {h.activo ? "Sí" : "No"}
                        </span>
                      </td>
                      <td>
                        <Button size="sm"
                          variant={h.notas ? "outline-warning" : "outline-secondary"}
                          onClick={() => abrirNotas(h)}
                          title={h.notas || "Sin notas"}
                        >
                          {h.notas ? "✏️ Ver" : "+ Notas"}
                        </Button>
                      </td>
                      <td>
                        <div className="d-flex gap-1 flex-wrap">
                          <Button size="sm" variant="success"  onClick={() => cambiarEstado(h.id, "disponible")}>Disponible</Button>
                          <Button size="sm" variant="warning"  onClick={() => cambiarEstado(h.id, "mantenimiento")}>Mant.</Button>
                          <Button size="sm" variant="secondary" onClick={() => cambiarEstado(h.id, "fuera_servicio")}>F. Servicio</Button>
                          <Button size="sm" variant="outline-danger" onClick={() => toggleActivo(h.id, h.activo)}>
                            {h.activo ? "Desactivar" : "Activar"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
      )}

      {/* Modal notas por habitación */}
      <Modal show={showNotas} onHide={() => setShowNotas(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Notas — Hab. {notasHabNum}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Label>Comentarios internos / estado físico</Form.Label>
          <Form.Control as="textarea" rows={4} value={notasTexto}
            onChange={e => setNotasTexto(e.target.value)}
            placeholder="Ej: Grifo roto, pintura deteriorada, TV dañada..." />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNotas(false)} disabled={guardandoNotas}>Cancelar</Button>
          <Button variant="primary" onClick={guardarNotas} disabled={guardandoNotas}>
            {guardandoNotas ? <><Spinner animation="border" size="sm" className="me-1" />Guardando...</> : "Guardar notas"}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showCrear} onHide={() => setShowCrear(false)} centered>
        <Modal.Header closeButton><Modal.Title>Crear habitacion</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Numero *</Form.Label>
            <Form.Control value={nuevoNumero} onChange={(e) => setNuevoNumero(e.target.value)} placeholder="Ej: 201" />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Tipo *</Form.Label>
            <Form.Select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)}>
              <option value="">Seleccione...</option>
              {tipos.length > 0
                ? tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre} ({t.codigo})</option>)
                : <><option value="DBL">Doble (DBL)</option><option value="STE">Suite (STE)</option><option value="SGL">Sencilla (SGL)</option></>}
            </Form.Select>
          </Form.Group>
          <Form.Group>
            <Form.Label>Capacidad</Form.Label>
            <Form.Control type="number" value={nuevaCap} min={1} max={10} onChange={(e) => setNuevaCap(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowCrear(false)}>Cancelar</Button>
          <Button variant="primary" onClick={crearHabitacion} disabled={guardando}>{guardando ? "Creando..." : "Crear"}</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TAB 2 — TARIFAS Y PLANES
// ─────────────────────────────────────────────────────────────────────────────
function TabTarifas({ planes, onPlanesChange }) {
  const [tarifas,     setTarifas]     = useState([]);
  const [tipos,       setTipos]       = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState("");
  const [filtroTipo,  setFiltroTipo]  = useState("");
  const [filtroPlan,  setFiltroPlan]  = useState("");
  const [filtroVig,   setFiltroVig]   = useState("");
  const [showModal,   setShowModal]   = useState(false);
  const [modoBorrar,  setModoBorrar]  = useState(false);
  const [tarifaSel,   setTarifaSel]   = useState(null);
  const [guardando,   setGuardando]   = useState(false);
  const [formErr,     setFormErr]     = useState("");
  const [planEsNuevo, setPlanEsNuevo] = useState(false); // modo campo libre

  const formVacio = { tipo_habitacion: "", plan: "", planNuevo: "", precio: "", fecha_inicio: "", fecha_fin: "", temporada: "base" };
  const [form, setForm] = useState(formVacio);
  const setF = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = {};
      if (filtroTipo) params.tipo_habitacion = filtroTipo;
      if (filtroPlan) params.plan = filtroPlan;
      if (filtroVig === "vigente") params.vigente = "true";
      if (filtroVig === "vencida") params.vigente = "false";
      const { data } = await tarifasService.listar(params);
      setTarifas(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || "No se pudieron cargar las tarifas.");
    } finally { setLoading(false); }
  }, [filtroTipo, filtroPlan, filtroVig]);

  const cargarTipos = useCallback(async () => {
    try {
      const { data } = await habitacionesService.tipos();
      setTipos(Array.isArray(data) ? data : []);
    } catch { setTipos([]); }
  }, []);

  useEffect(() => { cargar(); cargarTipos(); }, []); // eslint-disable-line

  const abrirCrear = () => {
    setTarifaSel(null); setModoBorrar(false); setFormErr(""); setPlanEsNuevo(false);
    setForm({ ...formVacio, plan: planes[0] || "" });
    setShowModal(true);
  };

  const abrirEditar = (t) => {
    setTarifaSel(t); setModoBorrar(false); setFormErr(""); setPlanEsNuevo(false);
    setForm({
      tipo_habitacion: t.tipo_habitacion, plan: t.plan, planNuevo: "",
      precio: t.precio, fecha_inicio: t.fecha_inicio?.slice(0, 10) || "",
      fecha_fin: t.fecha_fin?.slice(0, 10) || "", temporada: t.temporada || "base",
    });
    setShowModal(true);
  };

  const abrirBorrar = (t) => { setTarifaSel(t); setModoBorrar(true); setShowModal(true); };

  const guardar = async () => {
    setFormErr("");
    const planFinal = planEsNuevo ? (form.planNuevo || "").trim().toUpperCase() : (form.plan || "").trim().toUpperCase();
    if (!form.tipo_habitacion) return setFormErr("Selecciona el tipo de habitacion.");
    if (!planFinal) return setFormErr("El nombre del plan es obligatorio (ej: C2, EJECUTIVO).");
    if (!form.precio || Number(form.precio) <= 0) return setFormErr("El precio debe ser mayor a 0.");
    if (!form.fecha_inicio || !form.fecha_fin) return setFormErr("Las fechas de vigencia son obligatorias.");
    if (form.fecha_fin < form.fecha_inicio) return setFormErr("La fecha fin debe ser igual o posterior al inicio.");

    const body = { tipo_habitacion: form.tipo_habitacion, plan: planFinal, precio: form.precio,
                   fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin, temporada: form.temporada };
    try {
      setGuardando(true);
      if (tarifaSel) {
        await tarifasService.actualizar(tarifaSel.id, body);
      } else {
        await tarifasService.crear(body);
      }
      setShowModal(false);
      await cargar();
      if (onPlanesChange) onPlanesChange(); // refresca lista de planes
    } catch (e) { setFormErr(e?.response?.data?.message || "Error al guardar la tarifa."); }
    finally { setGuardando(false); }
  };

  const borrar = async () => {
    try {
      setGuardando(true);
      await tarifasService.eliminar(tarifaSel.id);
      setShowModal(false); await cargar();
      if (onPlanesChange) onPlanesChange();
    } catch (e) { alert(e?.response?.data?.message || "Error al eliminar."); }
    finally { setGuardando(false); }
  };

  const fmtF  = (f) => (f ? dayjs(f).format("DD/MM/YYYY") : "—");
  const esVig = (t) => dayjs() >= dayjs(t.fecha_inicio) && dayjs() <= dayjs(t.fecha_fin);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h4 className="mb-0" style={{ fontWeight: 700 }}>Tarifas y planes</h4>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Crea planes (C1, C2, GK...) con precio por tipo de habitacion y rango de fechas.
            Al crear una reserva, el sistema usa la tarifa vigente para ese plan y tipo.
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={abrirCrear}>+ Nueva tarifa</Button>
      </div>

      {/* Filtros */}
      <div className="d-flex gap-2 mb-3 flex-wrap align-items-end">
        <div>
          <div className="text-muted mb-1" style={{ fontSize: 12 }}>Tipo habitacion</div>
          <select className="form-select form-select-sm" value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)} style={{ minWidth: 150 }}>
            <option value="">Todos</option>
            {tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre} ({t.codigo})</option>)}
          </select>
        </div>
        <div>
          <div className="text-muted mb-1" style={{ fontSize: 12 }}>Plan</div>
          <select className="form-select form-select-sm" value={filtroPlan}
            onChange={(e) => setFiltroPlan(e.target.value)} style={{ minWidth: 120 }}>
            <option value="">Todos</option>
            {planes.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <div className="text-muted mb-1" style={{ fontSize: 12 }}>Vigencia</div>
          <select className="form-select form-select-sm" value={filtroVig}
            onChange={(e) => setFiltroVig(e.target.value)} style={{ minWidth: 130 }}>
            <option value="">Todas</option>
            <option value="vigente">Solo vigentes</option>
            <option value="vencida">Solo vencidas</option>
          </select>
        </div>
        <Button variant="outline-primary" size="sm" onClick={cargar}>Filtrar</Button>
        <Button variant="outline-secondary" size="sm" onClick={() => {
          setFiltroTipo(""); setFiltroPlan(""); setFiltroVig(""); setTimeout(cargar, 50);
        }}>Limpiar</Button>
      </div>

      {error   && <div className="alert alert-danger py-2">{error}</div>}
      {loading && <div className="text-muted">Cargando tarifas...</div>}

      {!loading && tarifas.length === 0 && (
        <div className="alert alert-warning">
          No hay tarifas registradas con esos filtros.
          {tarifas.length === 0 && !filtroTipo && !filtroPlan && (
            <div className="mt-1" style={{ fontSize: 13 }}>
              Crea tu primera tarifa con el boton "+ Nueva tarifa". Puedes usar cualquier nombre de plan: C1, C2, GK, etc.
            </div>
          )}
        </div>
      )}

      {!loading && tarifas.length > 0 && (
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead className="table-dark">
              <tr>
                <th>Plan</th><th>Tipo habitacion</th><th>Temporada</th>
                <th>Precio / noche</th><th>Desde</th><th>Hasta</th>
                <th>Estado</th><th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {tarifas.map((t) => (
                <tr key={t.id}>
                  <td><Badge bg="primary" style={{ fontSize: 13 }}>{t.plan}</Badge></td>
                  <td className="fw-semibold">{t.tipo_habitacion}</td>
                  <td><Badge bg="secondary">{t.temporada || "base"}</Badge></td>
                  <td className="fw-semibold">{money(t.precio)}</td>
                  <td>{fmtF(t.fecha_inicio)}</td>
                  <td>{fmtF(t.fecha_fin)}</td>
                  <td>
                    {esVig(t) ? <Badge bg="success">Vigente</Badge> : <Badge bg="secondary">Vencida</Badge>}
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Button size="sm" variant="outline-primary" onClick={() => abrirEditar(t)}>Editar</Button>
                      <Button size="sm" variant="outline-danger"  onClick={() => abrirBorrar(t)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Modal crear/editar/borrar ── */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modoBorrar ? "Eliminar tarifa" : tarifaSel ? "Editar tarifa" : "Nueva tarifa"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modoBorrar ? (
            <p>
              Vas a eliminar la tarifa del plan <b>{tarifaSel?.plan}</b> para tipo{" "}
              <b>{tarifaSel?.tipo_habitacion}</b> ({fmtF(tarifaSel?.fecha_inicio)} — {fmtF(tarifaSel?.fecha_fin)}).
              Esta accion no se puede deshacer.
            </p>
          ) : (
            <>
              {formErr && <div className="alert alert-danger py-2" style={{ fontSize: 13 }}>{formErr}</div>}

              <div className="row g-2">
                {/* Tipo de habitacion */}
                <div className="col-12">
                  <label className="form-label">Tipo de habitacion *</label>
                  <select className="form-select" value={form.tipo_habitacion}
                    onChange={(e) => setF("tipo_habitacion", e.target.value)}>
                    <option value="">Seleccione...</option>
                    {tipos.length > 0
                      ? tipos.map((t) => <option key={t.codigo} value={t.codigo}>{t.nombre} ({t.codigo})</option>)
                      : <><option value="DBL">Doble (DBL)</option><option value="STE">Suite (STE)</option><option value="SGL">Sencilla (SGL)</option></>}
                  </select>
                </div>

                {/* Plan — selector existente O campo nuevo */}
                <div className="col-12">
                  <label className="form-label">Plan *</label>
                  <div className="d-flex gap-2 align-items-center mb-1">
                    <div className="form-check mb-0">
                      <input className="form-check-input" type="radio" id="planExistente"
                        checked={!planEsNuevo} onChange={() => setPlanEsNuevo(false)} />
                      <label className="form-check-label" htmlFor="planExistente">Plan existente</label>
                    </div>
                    <div className="form-check mb-0">
                      <input className="form-check-input" type="radio" id="planNuevo"
                        checked={planEsNuevo} onChange={() => setPlanEsNuevo(true)} />
                      <label className="form-check-label" htmlFor="planNuevo">Crear plan nuevo</label>
                    </div>
                  </div>

                  {!planEsNuevo ? (
                    <select className="form-select" value={form.plan}
                      onChange={(e) => setF("plan", e.target.value)}>
                      <option value="">Seleccione...</option>
                      {planes.length > 0
                        ? planes.map((p) => <option key={p} value={p}>{p}</option>)
                        : <><option value="C1">C1</option><option value="GK">GK</option></>}
                    </select>
                  ) : (
                    <>
                      <input className="form-control" value={form.planNuevo}
                        onChange={(e) => setF("planNuevo", e.target.value.toUpperCase())}
                        placeholder="Ej: C2, EJECUTIVO, PREMIUM..." />
                      <div className="form-text">
                        Escribe el nombre del plan nuevo. Se guardara en mayusculas (C2, GK, EJECUTIVO...).
                        Una vez creada la tarifa, el plan estara disponible en reservas y walk-ins.
                      </div>
                    </>
                  )}
                </div>

                {/* Precio */}
                <div className="col-md-6">
                  <label className="form-label">Precio por noche (COP) *</label>
                  <input type="number" className="form-control" value={form.precio} min={1}
                    onChange={(e) => setF("precio", e.target.value)} placeholder="Ej: 190000" />
                </div>

                {/* Temporada */}
                <div className="col-md-6">
                  <label className="form-label">Temporada</label>
                  <select className="form-select" value={form.temporada}
                    onChange={(e) => setF("temporada", e.target.value)}>
                    {TEMPORADAS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                {/* Fechas */}
                <div className="col-md-6">
                  <label className="form-label">Fecha inicio vigencia *</label>
                  <input type="date" className="form-control" value={form.fecha_inicio}
                    onChange={(e) => setF("fecha_inicio", e.target.value)} />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Fecha fin vigencia *</label>
                  <input type="date" className="form-control" value={form.fecha_fin}
                    min={form.fecha_inicio || undefined}
                    onChange={(e) => setF("fecha_fin", e.target.value)} />
                </div>

                <div className="col-12">
                  <div className="alert alert-light py-2 mb-0" style={{ fontSize: 12, border: "1px solid #e8edf2" }}>
                    <b>Como funciona:</b> Al crear una reserva para una habitacion con plan <b>C2</b>,
                    el sistema busca la tarifa de plan C2 + tipo de esa habitacion que este vigente en las fechas de la reserva.
                    Puedes tener multiples rangos de fechas (temporada alta, baja, etc.) para el mismo plan.
                  </div>
                </div>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
          {modoBorrar
            ? <Button variant="danger" onClick={borrar} disabled={guardando}>{guardando ? "Eliminando..." : "Eliminar"}</Button>
            : <Button variant="primary" onClick={guardar} disabled={guardando}>{guardando ? "Guardando..." : tarifaSel ? "Guardar cambios" : "Crear tarifa"}</Button>
          }
        </Modal.Footer>
      </Modal>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// RF-20: Tab catálogo de servicios adicionales
// ─────────────────────────────────────────────────────────────────────────────
function TabServicios() {
  const [servicios, setServicios] = useState([]);
  const [cargando,  setCargando]  = useState(false);
  const [err,       setErr]       = useState("");
  const [showModal, setShowModal] = useState(false);
  const [seleccionado, setSel]    = useState(null);
  const [modoBorrar, setModoBorrar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Form
  const [nombre,      setNombre]      = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [precio,      setPrecio]      = useState("");
  const [unidad,      setUnidad]      = useState("por unidad");
  const [activo,      setActivo]      = useState(true);

  const cargar = useCallback(async () => {
    setCargando(true); setErr("");
    try {
      const { data } = await serviciosService.listar();
      setServicios(Array.isArray(data) ? data : []);
    } catch(e) {
      // Si el endpoint no existe aún, muestra mensaje amigable
      setErr("Endpoint /api/servicios no disponible. Asegurate de agregar la ruta en el backend.");
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const abrirCrear = () => {
    setSel(null); setModoBorrar(false);
    setNombre(""); setDescripcion(""); setPrecio(""); setUnidad("por unidad"); setActivo(true);
    setShowModal(true);
  };

  const abrirEditar = (s) => {
    setSel(s); setModoBorrar(false);
    setNombre(s.nombre||""); setDescripcion(s.descripcion||""); setPrecio(s.precio||"");
    setUnidad(s.unidad||"por unidad"); setActivo(s.activo !== false);
    setShowModal(true);
  };

  const abrirBorrar = (s) => {
    setSel(s); setModoBorrar(true); setShowModal(true);
  };

  const guardar = async () => {
    if (!nombre.trim() || !precio) return;
    setGuardando(true);
    try {
      const body = { nombre: nombre.trim(), descripcion: descripcion.trim(), precio: Number(precio), unidad, activo };
      if (seleccionado) {
        await serviciosService.actualizar(seleccionado.id, body);
      } else {
        await serviciosService.crear(body);
      }
      setShowModal(false);
      cargar();
    } catch(e) {
      alert(e?.response?.data?.message || "Error al guardar el servicio.");
    } finally { setGuardando(false); }
  };

  const borrar = async () => {
    if (!seleccionado) return;
    setGuardando(true);
    try {
      await serviciosService.eliminar(seleccionado.id);
      setShowModal(false);
      cargar();
    } catch(e) {
      alert(e?.response?.data?.message || "Error al eliminar el servicio.");
    } finally { setGuardando(false); }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <div className="fw-semibold" style={{ fontSize:15 }}>Catálogo de servicios adicionales</div>
          <div className="text-muted" style={{ fontSize:12 }}>Minibar, lavandería, transporte u otros servicios cargables a la habitación.</div>
        </div>
        <Button variant="primary" size="sm" onClick={abrirCrear}>Nuevo servicio</Button>
      </div>

      {err && <Alert variant="warning">{err}</Alert>}

      {cargando ? (
        <div className="text-center py-4"><Spinner animation="border"/></div>
      ) : (
        <div className="table-responsive">
          <Table size="sm" hover className="align-middle">
            <thead className="table-dark">
              <tr>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Precio</th>
                <th>Unidad</th>
                <th>Estado</th>
                <th style={{ width:120 }}></th>
              </tr>
            </thead>
            <tbody>
              {servicios.length === 0 ? (
                <tr><td colSpan={6} className="text-center text-muted py-4">Sin servicios registrados.</td></tr>
              ) : servicios.map(s => (
                <tr key={s.id}>
                  <td className="fw-semibold">{s.nombre}</td>
                  <td className="text-muted" style={{ fontSize:12 }}>{s.descripcion||"—"}</td>
                  <td className="fw-semibold text-success">{money(s.precio)}</td>
                  <td style={{ fontSize:12 }}>{s.unidad||"—"}</td>
                  <td>
                    <Badge bg={s.activo !== false ? "success" : "secondary"} style={{ fontSize:11 }}>
                      {s.activo !== false ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td>
                    <div className="d-flex gap-1">
                      <Button variant="outline-primary" size="sm" onClick={() => abrirEditar(s)}>Editar</Button>
                      <Button variant="outline-danger"  size="sm" onClick={() => abrirBorrar(s)}>Eliminar</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}

      {/* Modal crear/editar/borrar */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>
            {modoBorrar ? "Eliminar servicio" : seleccionado ? "Editar servicio" : "Nuevo servicio"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modoBorrar ? (
            <p>¿Estás seguro de eliminar el servicio <strong>{seleccionado?.nombre}</strong>? Esta acción no se puede deshacer.</p>
          ) : (
            <Row className="g-3">
              <Col xs={12}>
                <Form.Label>Nombre del servicio *</Form.Label>
                <Form.Control value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Minibar, Lavandería" />
              </Col>
              <Col xs={12}>
                <Form.Label>Descripción</Form.Label>
                <Form.Control as="textarea" rows={2} value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Opcional" />
              </Col>
              <Col xs={6}>
                <Form.Label>Precio (COP) *</Form.Label>
                <Form.Control type="number" min="0" value={precio} onChange={e => setPrecio(e.target.value)} placeholder="0" />
              </Col>
              <Col xs={6}>
                <Form.Label>Unidad de cobro</Form.Label>
                <Form.Select value={unidad} onChange={e => setUnidad(e.target.value)}>
                  <option value="por unidad">Por unidad</option>
                  <option value="por noche">Por noche</option>
                  <option value="por persona">Por persona</option>
                  <option value="por uso">Por uso</option>
                  <option value="por kg">Por kg</option>
                </Form.Select>
              </Col>
              <Col xs={12}>
                <Form.Check type="switch" label="Servicio activo" checked={activo} onChange={e => setActivo(e.target.checked)} />
              </Col>
            </Row>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
          {modoBorrar
            ? <Button variant="danger"  onClick={borrar}  disabled={guardando}>{guardando ? "Eliminando..." : "Eliminar"}</Button>
            : <Button variant="primary" onClick={guardar} disabled={guardando || !nombre.trim() || !precio}>{guardando ? "Guardando..." : seleccionado ? "Guardar cambios" : "Crear servicio"}</Button>
          }
        </Modal.Footer>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PÁGINA PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function Administracion() {
  const [tab,    setTab]    = useState("habitaciones");
  const [planes, setPlanes] = useState([]);

  const cargarPlanes = useCallback(async () => {
    try {
      const { data } = await tarifasService.listarPlanes();
      setPlanes(Array.isArray(data) ? data : []);
    } catch {
      // Si aún no hay tarifas creadas, usa defaults
      setPlanes(["C1", "GK"]);
    }
  }, []);

  useEffect(() => { cargarPlanes(); }, [cargarPlanes]);

  return (
    <div style={{ maxWidth: 1300, margin: "0 auto" }}>
      <div className="mb-3">
        <h3 style={{ fontWeight: 700, color: "#1a1a2e" }}>Administracion</h3>
        <div className="text-muted" style={{ fontSize: 13 }}>
          Habitaciones, tarifas, planes y catálogo de servicios adicionales.
        </div>
      </div>

      <Tabs activeKey={tab} onSelect={(k) => setTab(k || "habitaciones")} className="mb-3">
        <Tab eventKey="habitaciones" title="Habitaciones">
          <TabHabitaciones planes={planes} />
        </Tab>
        <Tab eventKey="tarifas" title="Tarifas y planes">
          <TabTarifas planes={planes} onPlanesChange={cargarPlanes} />
        </Tab>
        <Tab eventKey="servicios" title="Servicios adicionales">
          <TabServicios />
        </Tab>
      </Tabs>
    </div>
  );
}