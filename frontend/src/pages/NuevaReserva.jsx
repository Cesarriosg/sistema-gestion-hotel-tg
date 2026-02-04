// src/pages/NuevaReserva.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import { Card, Row, Col, Form, Button, Alert, Spinner, Badge } from "react-bootstrap";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const money = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("es-CO");
};

const planLabel = (p) => {
  const x = (p || "").toUpperCase();
  if (x === "GK") return "Gold King (GK)";
  if (x === "C1") return "Clásico 1 (C1)";
  return p || "—";
};

const TIPOS_DOC = [
  { value: "", label: "Seleccione..." },
  { value: "CC", label: "Cédula (CC)" },
  { value: "CE", label: "Cédula extranjería (CE)" },
  { value: "PA", label: "Pasaporte (PA)" },
  { value: "TI", label: "TI" },
  { value: "NIT", label: "NIT" },
];

export default function NuevaReserva() {
  const nav = useNavigate();
  const q = new URLSearchParams(useLocation().search);

  const [habNumero] = useState(q.get("hab") || "");
  const [desde] = useState(q.get("desde") || "");
  const [hasta] = useState(q.get("hasta") || "");

  // ✅ Solución A: si viene por query, bien; si no, lo cargamos por API usando habNumero
  const [tipoHabitacion, setTipoHabitacion] = useState(q.get("tipo") || "");
  const [cargandoTipo, setCargandoTipo] = useState(false);
  const [tipoErr, setTipoErr] = useState("");

  // ✅ Zeus: plan predeterminado
  const [plan, setPlan] = useState("C1");

  // ✅ HU-RH2 (Zeus): titular con autocompletar
  const [titular, setTitular] = useState({
    huesped_id: null,
    tipo_documento: "",
    documento: "",
    nombres: "",
    primer_apellido: "",
    segundo_apellido: "",
    telefono: "",
    email: "",
  });

  const [notas, setNotas] = useState("");

  // lookup estado
  const [buscandoHuesped, setBuscandoHuesped] = useState(false);
  const [busquedaMsg, setBusquedaMsg] = useState("");
  const lastKeyRef = useRef("");

  // Tarifa auto
  const [cargandoTarifa, setCargandoTarifa] = useState(false);
  const [tarifaErr, setTarifaErr] = useState("");
  const [tarifa, setTarifa] = useState(null); // {noches, precio_noche, total}

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const nombreCompleto = useMemo(() => {
    const parts = [titular.nombres, titular.primer_apellido, titular.segundo_apellido]
      .map((x) => (x || "").trim())
      .filter(Boolean);
    return parts.join(" ");
  }, [titular]);

  const noches = useMemo(() => {
    if (!desde || !hasta) return 0;
    const d = dayjs(desde);
    const h = dayjs(hasta);
    const n = h.diff(d, "day");
    return Math.max(n, 0);
  }, [desde, hasta]);

  // ✅ Solución A: cargar tipo por número (si no viene en query)
  const cargarTipoHabitacion = async () => {
    setTipoErr("");
    if (tipoHabitacion) return;
    if (!habNumero) {
      setTipoErr("No se recibió la habitación.");
      return;
    }

    try {
      setCargandoTipo(true);
      const r = await axios.get(`${API}/api/habitaciones/por-numero/${habNumero}`, {
        headers: getAuthHeaders(),
      });

      const t = (r.data?.tipo || "").toString().trim();
      if (!t) {
        setTipoErr("No se pudo determinar el tipo de la habitación.");
        return;
      }
      setTipoHabitacion(t);
    } catch (e) {
      console.error("Error cargando tipo habitación:", e);
      setTipoErr(e?.response?.data?.message || "No se pudo cargar el tipo de habitación.");
    } finally {
      setCargandoTipo(false);
    }
  };

  useEffect(() => {
    cargarTipoHabitacion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [habNumero]);

  // ✅ Zeus: autocompletar huésped por tipo_documento + documento
  useEffect(() => {
    const td = (titular.tipo_documento || "").trim().toUpperCase();
    const doc = (titular.documento || "").trim();

    setBuscandoHuesped(false);
    setBusquedaMsg("");

    // reglas mínimas para buscar (evita spam de llamadas)
    if (!td || doc.length < 5) {
      lastKeyRef.current = "";
      return;
    }

    const key = `${td}|${doc}`;
    lastKeyRef.current = key;

    const timer = setTimeout(async () => {
      try {
        setBuscandoHuesped(true);
        setBusquedaMsg("Buscando huésped...");

        const r = await axios.get(`${API}/api/huespedes/buscar`, {
          params: { tipo_documento: td, documento: doc },
          headers: getAuthHeaders(),
        });

        // si cambió mientras buscaba, ignorar
        if (lastKeyRef.current !== key) return;

        setTitular((prev) => ({
          ...prev,
          huesped_id: r.data.id ?? null,
          // documento/tipo_documento se mantienen
          nombres: r.data.nombres || prev.nombres || "",
          primer_apellido: r.data.primer_apellido || prev.primer_apellido || "",
          segundo_apellido: r.data.segundo_apellido || prev.segundo_apellido || "",
          telefono: r.data.telefono || prev.telefono || "",
          email: r.data.email || prev.email || "",
        }));

        setBusquedaMsg("Huésped encontrado. Datos autocompletados.");
      } catch (e) {
        if (lastKeyRef.current !== key) return;

        if (e?.response?.status === 404) {
          // No borrar lo que el usuario haya escrito, solo indicar
          setTitular((prev) => ({ ...prev, huesped_id: null }));
          setBusquedaMsg("No existe con ese documento. Puedes registrarlo manualmente.");
          return;
        }
        setBusquedaMsg(e?.response?.data?.message || "Error buscando huésped.");
      } finally {
        if (lastKeyRef.current === key) setBuscandoHuesped(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [titular.tipo_documento, titular.documento]);

  const cargarTarifa = async () => {
    setTarifaErr("");
    setTarifa(null);

    if (!tipoHabitacion) return;
    if (!desde || !hasta) {
      setTarifaErr("Rango de fechas incompleto.");
      return;
    }

    try {
      setCargandoTarifa(true);
      const r = await axios.get(`${API}/api/reservas/previsualizarPrecioReserva`, {
        params: { tipo: tipoHabitacion, plan, desde, hasta },
        headers: getAuthHeaders(),
      });
      setTarifa(r.data);
    } catch (e) {
      console.error("Error cargando tarifa:", e);
      setTarifaErr(e?.response?.data?.message || "No se pudo cargar la tarifa.");
    } finally {
      setCargandoTarifa(false);
    }
  };

  useEffect(() => {
    cargarTarifa();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, desde, hasta, tipoHabitacion]);

  const crear = async () => {
    setError("");

    // ✅ Validación Zeus: nombres + primer apellido
    if (!titular.nombres.trim() || !titular.primer_apellido.trim()) {
      setError("Nombres y primer apellido del huésped son obligatorios.");
      return;
    }

    // documento es opcional en reserva, pero si coloca documento debe colocar tipo_doc
    if (titular.documento.trim() && !titular.tipo_documento) {
      setError("Si ingresas documento, debes seleccionar tipo de documento.");
      return;
    }

    if (!tipoHabitacion) {
      setError("No se pudo determinar el tipo de habitación para calcular la tarifa.");
      return;
    }

    if (!tarifa || !Number(tarifa.total)) {
      setError("No hay tarifa cargada. Verifica plan/fechas.");
      return;
    }

    const tarifa_snapshot = {
      plan,
      plan_label: planLabel(plan),
      tipo_habitacion: tipoHabitacion,
      desde,
      hasta,
      noches: Number(tarifa.noches || noches || 1),
      precio_noche: Number(tarifa.precio_noche || 0),
      total: Number(tarifa.total || 0),
      moneda: "COP",
      generado_en: new Date().toISOString(),
    };

    try {
      setGuardando(true);

      await axios.post(
        `${API}/api/reservas`,
        {
          tipo: "reserva",
          habitacion_numero: habNumero,
          fecha_inicio: desde,
          fecha_fin: hasta,

          // ✅ huésped (Zeus)
          huesped_nombre: nombreCompleto || null, // compatibilidad
          tipo_documento: titular.tipo_documento || null,
          huesped_documento: titular.documento.trim() || null,
          huesped_telefono: titular.telefono.trim() || null,
          huesped_email: titular.email.trim() || null,

          nombres: titular.nombres.trim(),
          primer_apellido: titular.primer_apellido.trim(),
          segundo_apellido: titular.segundo_apellido.trim() || null,

          notas: notas.trim() || null,

          plan,
          tarifa_snapshot,
        },
        { headers: getAuthHeaders() }
      );

      nav("/calendario");
    } catch (e) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message;

      if (status === 409) {
        setError(msg || "La habitación ya está ocupada o reservada en ese rango.");
        return;
      }
      setError(msg || "No se pudo crear la reserva. Verifique la información.");
    } finally {
      setGuardando(false);
    }
  };

  const bloqueadoPorTipo = !tipoHabitacion || !!tipoErr || cargandoTipo;

  return (
    <div className="container" style={{ maxWidth: 980, paddingTop: 18, paddingBottom: 24 }}>
      <Card className="shadow-sm">
        <Card.Body style={{ padding: 22 }}>
          <div className="d-flex justify-content-between align-items-start">
            <div>
              <h3 className="mb-1">Nueva reserva</h3>
              <div className="text-muted">Crea una reserva con plan y tarifa automáticos.</div>
            </div>

            <div className="text-end">
              <div className="fw-semibold">Habitación: {habNumero || "—"}</div>
              <div className="text-muted">
                Rango: {desde || "—"} → {hasta || "—"}
              </div>

              {cargandoTipo ? (
                <div className="text-muted d-flex align-items-center justify-content-end gap-2 mt-1">
                  <Spinner animation="border" size="sm" />
                  <span>Cargando tipo...</span>
                </div>
              ) : tipoHabitacion ? (
                <div className="text-muted mt-1">
                  Tipo: <Badge bg="light" text="dark">{tipoHabitacion}</Badge>
                </div>
              ) : tipoErr ? (
                <div className="text-danger mt-1">{tipoErr}</div>
              ) : null}
            </div>
          </div>

          <hr className="my-4" />

          {error && <Alert variant="danger" className="py-2">{error}</Alert>}

          <Row className="g-3">
            {/* Col Izquierda: Datos huésped (Zeus) */}
            <Col md={7}>
              <Card className="border-0" style={{ background: "#f8fafc" }}>
                <Card.Body>
                  <div className="fw-semibold mb-2">Datos del huésped</div>

                  <Row className="g-2">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Tipo doc.</Form.Label>
                        <Form.Select
                          value={titular.tipo_documento}
                          onChange={(e) =>
                            setTitular((p) => ({ ...p, tipo_documento: e.target.value }))
                          }
                        >
                          {TIPOS_DOC.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.label}
                            </option>
                          ))}
                        </Form.Select>
                      </Form.Group>
                    </Col>

                    <Col md={8}>
                      <Form.Group>
                        <Form.Label>Documento</Form.Label>
                        <Form.Control
                          value={titular.documento}
                          onChange={(e) =>
                            setTitular((p) => ({ ...p, documento: e.target.value }))
                          }
                          placeholder="Escribe el documento para autocompletar…"
                        />
                        <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                          {buscandoHuesped ? (
                            <span className="d-inline-flex align-items-center gap-2">
                              <Spinner size="sm" animation="border" /> Buscando huésped…
                            </span>
                          ) : busquedaMsg ? (
                            <span className={busquedaMsg.includes("Error") ? "text-danger" : "text-muted"}>
                              {busquedaMsg}
                            </span>
                          ) : (
                            "Si existe, se autocompletan nombres, apellidos, teléfono y email."
                          )}
                        </div>
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="g-2 mt-2">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Nombres *</Form.Label>
                        <Form.Control
                          value={titular.nombres}
                          onChange={(e) => setTitular((p) => ({ ...p, nombres: e.target.value }))}
                          placeholder="Ej: Carlos"
                        />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Primer apellido *</Form.Label>
                        <Form.Control
                          value={titular.primer_apellido}
                          onChange={(e) =>
                            setTitular((p) => ({ ...p, primer_apellido: e.target.value }))
                          }
                          placeholder="Ej: Cruz"
                        />
                      </Form.Group>
                    </Col>

                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Segundo apellido</Form.Label>
                        <Form.Control
                          value={titular.segundo_apellido}
                          onChange={(e) =>
                            setTitular((p) => ({ ...p, segundo_apellido: e.target.value }))
                          }
                          placeholder="Opcional"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="g-2 mt-2">
                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Teléfono</Form.Label>
                        <Form.Control
                          value={titular.telefono}
                          onChange={(e) =>
                            setTitular((p) => ({ ...p, telefono: e.target.value }))
                          }
                          placeholder="Ej: 3001234567"
                        />
                      </Form.Group>
                    </Col>

                    <Col md={6}>
                      <Form.Group>
                        <Form.Label>Email</Form.Label>
                        <Form.Control
                          value={titular.email}
                          onChange={(e) => setTitular((p) => ({ ...p, email: e.target.value }))}
                          placeholder="correo@..."
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <div className="text-muted mt-2" style={{ fontSize: 12 }}>
                    Nombre completo (auto): <b>{nombreCompleto || "—"}</b>
                  </div>

                  <Form.Group className="mt-3">
                    <Form.Label>Notas internas (opcional)</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={3}
                      value={notas}
                      onChange={(e) => setNotas(e.target.value)}
                      placeholder="Ej: Llegará tarde, requiere cuna, alergias, etc."
                    />
                  </Form.Group>
                </Card.Body>
              </Card>
            </Col>

            {/* Col Derecha: Zeus - plan + tarifa auto */}
            <Col md={5}>
              <Card className="border-0" style={{ background: "#f8fafc" }}>
                <Card.Body>
                  <div className="fw-semibold mb-2">Plan y tarifa</div>

                  <Form.Group className="mb-2">
                    <Form.Label>Plan</Form.Label>
                    <Form.Select
                      value={plan}
                      onChange={(e) => setPlan(e.target.value)}
                      disabled={bloqueadoPorTipo}
                    >
                      <option value="C1">Clásico 1 (C1)</option>
                      <option value="GK">Gold King (GK)</option>
                    </Form.Select>
                  </Form.Group>

                  <div className="p-3 rounded" style={{ background: "#ffffff", border: "1px solid #e5e7eb" }}>
                    {bloqueadoPorTipo ? (
                      <div className={tipoErr ? "text-danger" : "text-muted"}>
                        {cargandoTipo ? "Cargando tipo de habitación..." : tipoErr || "Esperando tipo de habitación..."}
                      </div>
                    ) : cargandoTarifa ? (
                      <div className="d-flex align-items-center gap-2">
                        <Spinner animation="border" size="sm" />
                        <div>Cargando tarifa...</div>
                      </div>
                    ) : tarifaErr ? (
                      <div className="text-danger">{tarifaErr}</div>
                    ) : !tarifa ? (
                      <div className="text-muted">No hay tarifa calculada.</div>
                    ) : (
                      <>
                        <div className="d-flex justify-content-between mb-1">
                          <div className="text-muted">Noches</div>
                          <div className="fw-semibold">{tarifa.noches}</div>
                        </div>
                        <div className="d-flex justify-content-between mb-1">
                          <div className="text-muted">Tarifa / noche</div>
                          <div className="fw-semibold">${money(tarifa.precio_noche)}</div>
                        </div>

                        <hr className="my-2" />

                        <div className="d-flex justify-content-between">
                          <div className="fw-semibold">Total estimado</div>
                          <div className="fw-bold fs-5">${money(tarifa.total)}</div>
                        </div>

                        <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                          Se guardará como snapshot en la reserva.
                        </div>
                      </>
                    )}
                  </div>

                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="primary"
                      className="w-100"
                      onClick={crear}
                      disabled={
                        guardando ||
                        !titular.nombres.trim() ||
                        !titular.primer_apellido.trim() ||
                        !tarifa ||
                        !!tarifaErr ||
                        bloqueadoPorTipo
                      }
                    >
                      {guardando ? "Creando..." : "Crear reserva"}
                    </Button>

                    <Button variant="outline-secondary" onClick={() => nav(-1)} disabled={guardando}>
                      Cancelar
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
}
