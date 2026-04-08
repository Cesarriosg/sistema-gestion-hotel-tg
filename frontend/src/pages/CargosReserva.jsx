import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs";
import { Button, Form, Badge } from "react-bootstrap";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export default function CargosReserva() {
  const { id } = useParams();

  const [loading, setLoading] = useState(false);
  const [reserva, setReserva] = useState(null);
  const [pagos, setPagos] = useState([]);

  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Promociones
  const [promos,        setPromos]        = useState([]);
  const [promoSel,      setPromoSel]      = useState("");
  const [aplicando,     setAplicando]     = useState(false);
  const [promoMsg,      setPromoMsg]      = useState({ text: "", ok: false });

  const cargar = async () => {
    try {
      setLoading(true);
      const r = await axios.get(`${API}/api/reservas/${id}/finanzas`, {
        headers: getAuthHeaders(),
      });
      setReserva(r.data?.reserva || null);
      setPagos(Array.isArray(r.data?.movimientos) ? r.data.movimientos : []);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudieron cargar los cargos.");
      setReserva(null);
      setPagos([]);
    } finally {
      setLoading(false);
    }
  };

  const cargarPromos = async () => {
    try {
      const r = await axios.get(`${API}/api/reservas/${id}/promociones-aplicables`, {
        headers: getAuthHeaders(),
      });
      setPromos(r.data?.promociones || []);
    } catch {
      setPromos([]);
    }
  };

  useEffect(() => {
    cargar();
    cargarPromos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Cargos = tipo 'cargo' + descuentos
  const cargos = useMemo(() => {
    return (pagos || []).filter((p) => ["cargo", "descuento"].includes(String(p.tipo).toLowerCase()));
  }, [pagos]);

  const totalCargos = useMemo(() => {
    return (pagos || [])
      .filter(p => p.tipo === "cargo")
      .reduce((acc, c) => acc + Number(c.monto || 0), 0);
  }, [pagos]);

  const totalDescuentos = useMemo(() => {
    return (pagos || [])
      .filter(p => p.tipo === "descuento")
      .reduce((acc, c) => acc + Number(c.monto || 0), 0);
  }, [pagos]);

  const crearCargo = async () => {
    const m = Number(monto);
    if (!m || Number.isNaN(m) || m <= 0) {
      alert("Monto inválido.");
      return;
    }
    if (!descripcion.trim()) {
      alert("Escribe una descripción (ej: Minibar, Lavandería, etc.).");
      return;
    }

    try {
      setGuardando(true);

      //  IMPORTANTE:
      // Tu backend registrarPago inserta en "referencia" (NO existe columna "descripcion" en tu tabla).
      // Entonces aquí mandamos "referencia" o mandamos "descripcion" pero el backend debe guardarlo en referencia.
      await axios.post(
        `${API}/api/reservas/${id}/pagos`,
        {
          monto: m,
          metodo: "otro",
          tipo: "cargo",
          referencia: descripcion.trim(), //  alineado a tu tabla
        },
        { headers: getAuthHeaders() }
      );

      setMonto("");
      setDescripcion("");
      await cargar();
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudo registrar el cargo.");
    } finally {
      setGuardando(false);
    }
  };

  const aplicarPromocion = async () => {
    if (!promoSel) return;
    setPromoMsg({ text: "", ok: false });
    setAplicando(true);
    try {
      const r = await axios.post(
        `${API}/api/reservas/${id}/aplicar-promocion`,
        { promocion_id: Number(promoSel) },
        { headers: getAuthHeaders() }
      );
      const desc = r.data?.descuento_aplicado;
      setPromoMsg({ text: `✓ Descuento de $${Number(desc).toLocaleString("es-CO")} aplicado correctamente.`, ok: true });
      setPromoSel("");
      await cargar();
      await cargarPromos();
    } catch (e) {
      setPromoMsg({ text: e?.response?.data?.message || "Error al aplicar la promoción.", ok: false });
    } finally {
      setAplicando(false); }
  };

  const etiquetaCargo = (c) => {
    if (c.tipo === "descuento") return "DESCUENTO";
    const ref = String(c.referencia || "").toUpperCase();
    if (ref.startsWith("AUDITORIA ALOJAMIENTO")) return "AUDITORÍA";
    return "MANUAL";
  };

  const fechaCargo = (c) => {
    //  Si existe columna fecha (DATE), úsala como fecha operativa del cargo
    if (c.fecha) return dayjs(c.fecha).format("YYYY-MM-DD");
    // fallback
    return c.created_at ? dayjs(c.created_at).format("YYYY-MM-DD") : "—";
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="mb-0">🧾 Cargos (Folio) — Reserva #{id}</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Aquí se registran cargos manuales (minibar, lavandería, etc.) y también aparecerán los cargos generados por auditoría.
          </div>
        </div>

        <Button variant="outline-secondary" onClick={cargar} disabled={loading}>
          ↻ Refrescar
        </Button>
      </div>

      {reserva && (
        <div className="card shadow-sm mb-3">
          <div className="card-body">
            <div className="d-flex gap-2 flex-wrap">
              <Badge bg="dark">Hab: {reserva.habitacion_numero}</Badge>
              <Badge bg="secondary">
                Rango: {String(reserva.fecha_inicio).slice(0, 10)} → {String(reserva.fecha_fin).slice(0, 10)}
              </Badge>
              <Badge bg={reserva.estado === "ocupada" ? "danger" : "info"}>
                Estado: {reserva.estado}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {/* ── Aplicar promoción ── */}
      {reserva?.estado === "ocupada" && (
        <div className="card shadow-sm mb-3" style={{ borderLeft: "4px solid #2563eb" }}>
          <div className="card-body">
            <h5 className="mb-1">Aplicar promoción / descuento</h5>
            <div className="text-muted mb-3" style={{ fontSize: 12 }}>
              El descuento se registra como crédito sobre esta reserva y reduce el saldo pendiente.
            </div>

            {promos.length === 0 ? (
              <div className="alert alert-secondary py-2 mb-0" style={{ fontSize: 13 }}>
                No hay promociones activas aplicables a este plan / tipo de habitación / noches.
              </div>
            ) : (
              <div className="row g-2 align-items-end">
                <div className="col-md-8">
                  <Form.Label className="mb-1">Seleccionar promoción</Form.Label>
                  <Form.Select value={promoSel} onChange={e => setPromoSel(e.target.value)}>
                    <option value="">-- Seleccione una promoción --</option>
                    {promos.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                        {p.tipo === "porcentaje"    && ` — ${p.valor}% desc.`}
                        {p.tipo === "monto_fijo"    && ` — $${Number(p.valor).toLocaleString("es-CO")} desc.`}
                        {p.tipo === "noches_gratis" && ` — ${p.valor} noche(s) gratis`}
                        {" "}(ahorro estimado: ${Number(p.descuento_calculado || 0).toLocaleString("es-CO")})
                      </option>
                    ))}
                  </Form.Select>
                </div>
                <div className="col-md-4 d-flex align-items-end">
                  <Button
                    className="w-100"
                    variant="primary"
                    onClick={aplicarPromocion}
                    disabled={aplicando || !promoSel}
                  >
                    {aplicando ? "Aplicando..." : "Aplicar descuento"}
                  </Button>
                </div>
              </div>
            )}

            {promoMsg.text && (
              <div className={`alert py-2 mt-2 mb-0 ${promoMsg.ok ? "alert-success" : "alert-danger"}`}
                style={{ fontSize: 13 }}>
                {promoMsg.text}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="mb-2">Agregar cargo manual</h5>

          <div className="row g-2">
            <div className="col-md-3">
              <Form.Label className="mb-1">Monto</Form.Label>
              <Form.Control
                type="number"
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                placeholder="Ej: 15000"
              />
            </div>
            <div className="col-md-7">
              <Form.Label className="mb-1">Descripción</Form.Label>
              <Form.Control
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Ej: Minibar / Lavandería / Restaurante..."
              />
            </div>
            <div className="col-md-2 d-flex align-items-end">
              <Button className="w-100" onClick={crearCargo} disabled={guardando}>
                {guardando ? "Guardando..." : "Agregar"}
              </Button>
            </div>
          </div>

          <div className="text-muted mt-2" style={{ fontSize: 12 }}>
            Nota: el método se guarda como <b>otro</b> para cumplir la restricción CHECK de tu tabla pagos.
          </div>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
            <h5 className="mb-0">Cargos y descuentos</h5>
            <div className="d-flex gap-2">
              <Badge bg="dark">Cargos: ${totalCargos.toLocaleString("es-CO")}</Badge>
              {totalDescuentos > 0 && (
                <Badge bg="success">Descuentos: -${totalDescuentos.toLocaleString("es-CO")}</Badge>
              )}
            </div>
          </div>

          {loading ? (
            <div className="text-muted">Cargando...</div>
          ) : cargos.length === 0 ? (
            <div className="alert alert-warning mb-0">No hay cargos registrados para esta reserva.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm mb-0">
                <thead>
                  <tr>
                    <th>Tipo</th>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Monto</th>
                    <th>Método</th>
                  </tr>
                </thead>
                <tbody>
                  {cargos.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Badge bg={
                          etiquetaCargo(c) === "AUDITORÍA" ? "primary"
                          : etiquetaCargo(c) === "DESCUENTO" ? "success"
                          : "secondary"
                        }>
                          {etiquetaCargo(c)}
                        </Badge>
                      </td>
                      <td>{fechaCargo(c)}</td>
                      <td>{c.referencia || ""}</td>
                      <td style={{ color: c.tipo === "descuento" ? "#16a34a" : undefined, fontWeight: 600 }}>
                        {c.tipo === "descuento" ? "-" : ""}${Number(c.monto || 0).toLocaleString("es-CO")}
                      </td>
                      <td>{c.metodo}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
