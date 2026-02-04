// src/pages/Habitaciones.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Form, Button, Badge, Modal } from "react-bootstrap";
import { useAuth } from "../context/AuthContext"; // ✅ ajusta si tu ruta es diferente

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ESTADOS = ["disponible", "ocupada", "mantenimiento", "fuera_servicio", "reservada"];

export default function Habitaciones() {
  const { usuario } = useAuth();
  const isAdmin = usuario?.rol === "admin";

  const [habitaciones, setHabitaciones] = useState([]);
  const [tipos, setTipos] = useState([]);

  const [filtroTexto, setFiltroTexto] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroActivas, setFiltroActivas] = useState("todas");

  const [loading, setLoading] = useState(false);
  const [loadingTipos, setLoadingTipos] = useState(false);

  // ✅ Modal crear habitación (solo admin)
  const [showCrear, setShowCrear] = useState(false);
  const [nuevoNumero, setNuevoNumero] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("");
  const [nuevaCapacidad, setNuevaCapacidad] = useState(2);
  const [guardando, setGuardando] = useState(false);

  // ✅ Guarda por fila: plan + tarifa + loading
  const [edits, setEdits] = useState({}); // { [id]: { plan, tarifa, saving } }

  const cargarHabitaciones = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(`${API}/api/habitaciones`, {
        headers: getAuthHeaders(),
      });

      const lista = Array.isArray(data) ? data : [];
      setHabitaciones(lista);

      // inicializar edits con lo que viene del backend
      const next = {};
      for (const h of lista) {
        next[h.id] = {
          plan: h.plan ?? "C1",
          tarifa: h.tarifa_actual ?? "",
          saving: false,
        };
      }
      setEdits(next);
    } catch (e) {
      console.error("Error cargando habitaciones:", e);
      alert(e?.response?.data?.message || "No se pudieron cargar las habitaciones.");
      setHabitaciones([]);
      setEdits({});
    } finally {
      setLoading(false);
    }
  };

  const cargarTipos = async () => {
    try {
      setLoadingTipos(true);
      const { data } = await axios.get(`${API}/api/tipos-habitacion`, {
        headers: getAuthHeaders(),
      });

      const lista = Array.isArray(data) ? data : [];
      const activos = lista.filter((t) => t.activo === true);

      setTipos(activos);
      if (activos.length && !nuevoTipo) setNuevoTipo(activos[0].nombre);
    } catch (e) {
      console.warn("No se pudieron cargar tipos:", e?.response?.data?.message || e.message);
      setTipos([]);
    } finally {
      setLoadingTipos(false);
    }
  };

  const refrescar = async () => {
    await Promise.all([cargarTipos(), cargarHabitaciones()]);
  };

  useEffect(() => {
    refrescar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ✅ Cambiar estado (TU ENDPOINT ESTÁ COMENTADO EN BACKEND)
  // Por eso en tu caso debes usar el endpoint que sí tengas activo.
  // Si ya reactivaste router.put("/:id/estado") en backend, esto funciona.
  const cambiarEstado = async (id, nuevoEstado) => {
    try {
      await axios.put(
        `${API}/api/habitaciones/${id}/estado`,
        { estado: nuevoEstado },
        { headers: getAuthHeaders() }
      );
      await cargarHabitaciones();
    } catch (e) {
      console.error("Error cambiando estado:", e);
      alert(e?.response?.data?.message || "No se pudo cambiar el estado.");
    }
  };

  const cambiarTipo = async (id, nuevoTipoNombre) => {
    try {
      await axios.put(
        `${API}/api/habitaciones/${id}/tipo`,
        { tipo: nuevoTipoNombre },
        { headers: getAuthHeaders() }
      );
      await cargarHabitaciones();
    } catch (e) {
      console.error("Error cambiando tipo:", e);
      alert(e?.response?.data?.message || "No se pudo cambiar el tipo.");
    }
  };

  const cambiarActivo = async (id, activo) => {
    try {
      await axios.put(
        `${API}/api/habitaciones/${id}/activo`,
        { activo },
        { headers: getAuthHeaders() }
      );
      await cargarHabitaciones();
    } catch (e) {
      console.error("Error activando/desactivando:", e);
      alert(e?.response?.data?.message || "No se pudo activar/desactivar.");
    }
  };

  const crearHabitacion = async () => {
    const num = String(nuevoNumero || "").trim();
    if (!num) return alert("Número requerido.");
    if (!nuevoTipo) return alert("Tipo requerido.");

    try {
      setGuardando(true);
      await axios.post(
        `${API}/api/habitaciones`,
        {
          numero: num,
          tipo: nuevoTipo,
          capacidad: Number(nuevaCapacidad || 2),
        },
        { headers: getAuthHeaders() }
      );

      setNuevoNumero("");
      setNuevaCapacidad(2);
      setShowCrear(false);
      await cargarHabitaciones();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudo crear la habitación.");
    } finally {
      setGuardando(false);
    }
  };

  // ✅ guardar plan+tarifa por habitación (HU-PS3 simplificada)
  const guardarPlanTarifa = async (habId) => {
    const row = edits[habId] || {};
    const plan = String(row.plan || "").trim();
    const precio = Number(row.tarifa);

    if (!plan) return alert("Plan requerido.");
    if (Number.isNaN(precio) || precio <= 0) return alert("Tarifa inválida.");

    try {
      setEdits((prev) => ({
        ...prev,
        [habId]: { ...prev[habId], saving: true },
      }));

      await axios.put(
        `${API}/api/habitaciones/${habId}/plan-tarifa`,
        { plan, precio },
        { headers: getAuthHeaders() }
      );

      await cargarHabitaciones();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudo guardar plan/tarifa.");
    } finally {
      setEdits((prev) => ({
        ...prev,
        [habId]: { ...prev[habId], saving: false },
      }));
    }
  };

  const getBadge = (estado) => {
    if (estado === "disponible") return <Badge bg="success">Disponible</Badge>;
    if (estado === "ocupada") return <Badge bg="danger">Ocupada</Badge>;
    if (estado === "reservada") return <Badge bg="info">Reservada</Badge>;
    if (estado === "mantenimiento") return <Badge bg="warning" text="dark">Mantenimiento</Badge>;
    if (estado === "fuera_servicio") return <Badge bg="secondary">Fuera de servicio</Badge>;
    return <Badge bg="light" text="dark">{estado}</Badge>;
  };

  const listaFiltrada = useMemo(() => {
    return (habitaciones || []).filter((h) => {
      const texto = `${h.numero} ${h.tipo}`.toLowerCase();
      const pasaTexto = texto.includes(filtroTexto.toLowerCase());

      const pasaEstado = filtroEstado === "todos" ? true : h.estado === filtroEstado;

      const act = typeof h.activo === "boolean" ? h.activo : true;
      const pasaActivo =
        filtroActivas === "todas"
          ? true
          : filtroActivas === "activas"
          ? act === true
          : act === false;

      return pasaTexto && pasaEstado && pasaActivo;
    });
  }, [habitaciones, filtroTexto, filtroEstado, filtroActivas]);

  return (
    <div style={{ padding: 10 }}>
      <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h2 className="mb-0">⚙️ Administración de Habitaciones</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Crear / activar-desactivar / cambiar tipo y estado (se refleja en el Rack). <br />
            Además: editar <b>plan</b> y <b>tarifa</b> por habitación (HU-PS3 simplificada).
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={refrescar} disabled={loading || loadingTipos}>
            ↻ Recargar
          </Button>

          {/* ✅ solo admin puede crear habitación */}
          <Button
            variant="primary"
            onClick={() => setShowCrear(true)}
            disabled={!isAdmin || loadingTipos || tipos.length === 0}
            title={!isAdmin ? "Solo administrador" : tipos.length === 0 ? "No hay tipos activos" : ""}
          >
            + Crear habitación
          </Button>
        </div>
      </div>

      <div className="d-flex gap-2 my-3 flex-wrap">
        <Form.Control
          style={{ maxWidth: 260 }}
          placeholder="Buscar por número o tipo..."
          value={filtroTexto}
          onChange={(e) => setFiltroTexto(e.target.value)}
        />

        <Form.Select
          style={{ maxWidth: 220 }}
          value={filtroEstado}
          onChange={(e) => setFiltroEstado(e.target.value)}
        >
          <option value="todos">Todos los estados</option>
          {ESTADOS.map((x) => (
            <option key={x} value={x}>
              {x}
            </option>
          ))}
        </Form.Select>

        <Form.Select
          style={{ maxWidth: 220 }}
          value={filtroActivas}
          onChange={(e) => setFiltroActivas(e.target.value)}
        >
          <option value="todas">Todas (activas e inactivas)</option>
          <option value="activas">Solo activas</option>
          <option value="inactivas">Solo inactivas</option>
        </Form.Select>
      </div>

      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Número</th>
              <th style={{ minWidth: 220 }}>Tipo</th>
              <th>Estado</th>
              <th>Activa</th>

              {/* ✅ HU-PS3 simplificada */}
              <th style={{ minWidth: 130 }}>Plan</th>
              <th style={{ minWidth: 140 }}>Tarifa</th>
              <th style={{ minWidth: 110 }}>Guardar</th>

              <th>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="text-muted">
                  Cargando...
                </td>
              </tr>
            ) : (
              <>
                {listaFiltrada.map((h, idx) => {
                  const activa = typeof h.activo === "boolean" ? h.activo : true;
                  const row = edits[h.id] || { plan: h.plan ?? "C1", tarifa: h.tarifa_actual ?? "" };
                  const saving = Boolean(row.saving);

                  return (
                    <tr key={h.id} style={!activa ? { opacity: 0.6 } : undefined}>
                      <td>{idx + 1}</td>

                      <td>
                        <b>{h.numero}</b>
                      </td>

                      <td>
                        <Form.Select
                          size="sm"
                          value={h.tipo}
                          onChange={(e) => cambiarTipo(h.id, e.target.value)}
                          disabled={!activa || !isAdmin}
                          title={!isAdmin ? "Solo administrador" : ""}
                        >
                          {tipos.length === 0 ? (
                            <option value={h.tipo}>{h.tipo}</option>
                          ) : (
                            tipos.map((t) => (
                              <option key={t.id} value={t.nombre}>
                                {t.nombre} ({t.codigo})
                              </option>
                            ))
                          )}
                        </Form.Select>
                      </td>

                      <td>{getBadge(h.estado)}</td>

                      <td>
                        <Badge bg={activa ? "success" : "secondary"}>{activa ? "Sí" : "No"}</Badge>
                      </td>

                      {/* ✅ Plan */}
                      <td>
                        <Form.Control
                          size="sm"
                          value={row.plan ?? ""}
                          disabled={!activa || !isAdmin}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [h.id]: { ...prev[h.id], plan: e.target.value },
                            }))
                          }
                          placeholder="Ej: C1"
                        />
                      </td>

                      {/* ✅ Tarifa */}
                      <td>
                        <Form.Control
                          size="sm"
                          type="number"
                          value={row.tarifa ?? ""}
                          disabled={!activa || !isAdmin}
                          onChange={(e) =>
                            setEdits((prev) => ({
                              ...prev,
                              [h.id]: { ...prev[h.id], tarifa: e.target.value },
                            }))
                          }
                          placeholder="Ej: 190000"
                        />
                      </td>

                      {/* ✅ Guardar Plan+Tarifa */}
                      <td>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!activa || !isAdmin || saving}
                          onClick={() => guardarPlanTarifa(h.id)}
                        >
                          {saving ? "Guardando..." : "Guardar"}
                        </Button>
                      </td>

                      {/* ✅ Acciones rápidas */}
                      <td className="d-flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => cambiarEstado(h.id, "disponible")}
                          disabled={!activa || !isAdmin}
                          title={!isAdmin ? "Solo administrador" : ""}
                        >
                          Disponible
                        </Button>

                        <Button
                          size="sm"
                          variant="warning"
                          onClick={() => cambiarEstado(h.id, "mantenimiento")}
                          disabled={!activa || !isAdmin}
                          title={!isAdmin ? "Solo administrador" : ""}
                        >
                          Mantenimiento
                        </Button>

                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => cambiarEstado(h.id, "fuera_servicio")}
                          disabled={!activa || !isAdmin}
                          title={!isAdmin ? "Solo administrador" : ""}
                        >
                          Fuera de servicio
                        </Button>

                        {activa ? (
                          <Button
                            size="sm"
                            variant="outline-danger"
                            onClick={() => cambiarActivo(h.id, false)}
                            disabled={!isAdmin}
                            title={!isAdmin ? "Solo administrador" : ""}
                          >
                            Desactivar
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline-success"
                            onClick={() => cambiarActivo(h.id, true)}
                            disabled={!isAdmin}
                            title={!isAdmin ? "Solo administrador" : ""}
                          >
                            Activar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {!listaFiltrada.length && (
                  <tr>
                    <td colSpan={9} className="text-center text-muted">
                      No hay habitaciones que coincidan con el filtro.
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ Modal crear habitación (solo admin) */}
      <Modal show={showCrear} onHide={() => setShowCrear(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Crear habitación</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {!isAdmin ? (
            <div className="alert alert-warning mb-0">
              Solo un <b>administrador</b> puede crear habitaciones.
            </div>
          ) : (
            <>
              <Form.Group className="mb-2">
                <Form.Label>Número</Form.Label>
                <Form.Control
                  value={nuevoNumero}
                  onChange={(e) => setNuevoNumero(e.target.value)}
                  placeholder="Ej: 101"
                />
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Tipo</Form.Label>
                <Form.Select value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)}>
                  {tipos.map((t) => (
                    <option key={t.id} value={t.nombre}>
                      {t.nombre} ({t.codigo})
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group className="mb-2">
                <Form.Label>Capacidad</Form.Label>
                <Form.Control
                  type="number"
                  value={nuevaCapacidad}
                  onChange={(e) => setNuevaCapacidad(e.target.value)}
                  min={1}
                />
              </Form.Group>

              <div className="text-muted" style={{ fontSize: 12 }}>
                Se crea en estado <b>disponible</b> y <b>activa</b>.
              </div>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCrear(false)} disabled={guardando}>
            Cerrar
          </Button>

          {isAdmin && (
            <Button variant="primary" onClick={crearHabitacion} disabled={guardando}>
              {guardando ? "Creando..." : "Crear"}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
    </div>
  );
}
