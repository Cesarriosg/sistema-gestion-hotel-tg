import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const TIPOS_DOC = [
  { value: "", label: "Seleccione..." },
  { value: "CC", label: "Cédula (CC)" },
  { value: "CE", label: "Cédula extranjería (CE)" },
  { value: "PA", label: "Pasaporte (PA)" },
  { value: "TI", label: "TI" },
  { value: "NIT", label: "NIT" },
];


export default function HuespedLookup({ value, onChange }) {
  const [estado, setEstado] = useState("idle"); // idle | typing | loading | found | not_found | error
  const [msg, setMsg] = useState("");
  const timerRef = useRef(null);
  const lastKey = useRef("");

  const tipo = value?.tipo_documento || "";
  const documento = value?.documento || "";

  const key = useMemo(() => {
    return `${(tipo || "").trim().toUpperCase()}|${(documento || "").trim()}`;
  }, [tipo, documento]);

  const limpiarDatosNoDoc = () => {
    onChange({
      ...value,
      id: null,
      nombres: "",
      primer_apellido: "",
      segundo_apellido: "",
      nombre: "",
      telefono: "",
      email: "",
      fecha_nacimiento: "",
      fecha_expedicion: "",
      nacionalidad: "",
      ciudad: "",
      direccion: "",
    });
  };

  const aplicarEncontrado = (h) => {
    const nombreCompleto =
      [h.nombres, h.primer_apellido, h.segundo_apellido].filter(Boolean).join(" ").trim() ||
      (h.nombre || "").trim();

    onChange({
      ...value,
      id: h.id,
      tipo_documento: h.tipo_documento || tipo,
      documento: h.documento || documento,

      nombres: h.nombres || "",
      primer_apellido: h.primer_apellido || "",
      segundo_apellido: h.segundo_apellido || "",
      nombre: nombreCompleto,

      telefono: h.telefono || "",
      email: h.email || "",
      fecha_nacimiento: h.fecha_nacimiento || "",
      fecha_expedicion: h.fecha_expedicion || "",
      nacionalidad: h.nacionalidad || "",
      ciudad: h.ciudad || "",
      direccion: h.direccion || "",
    });
  };

  useEffect(() => {
    setMsg("");
    if (timerRef.current) clearTimeout(timerRef.current);

    const td = (tipo || "").trim();
    const doc = (documento || "").trim();

    if (!td || doc.length < 5) {
      setEstado(doc.length > 0 ? "typing" : "idle");
      return;
    }

    // Debounce
    timerRef.current = setTimeout(async () => {
      try {
        const currentKey = key;
        lastKey.current = currentKey;

        setEstado("loading");
        setMsg("Buscando huésped...");

        const r = await axios.get(`${API}/api/huespedes/buscar`, {
          params: { tipo_documento: td, documento: doc },
          headers: getAuthHeaders(),
        });

        // Si el usuario siguió escribiendo, ignoramos respuesta vieja
        if (lastKey.current !== currentKey) return;

        aplicarEncontrado(r.data);
        setEstado("found");
        setMsg("Huésped encontrado. Datos cargados automáticamente.");
      } catch (e) {
        if (lastKey.current !== key) return;

        const status = e?.response?.status;
        if (status === 404) {
          limpiarDatosNoDoc();
          setEstado("not_found");
          setMsg("No existe un huésped con ese documento. Puedes registrarlo.");
          return;
        }
        setEstado("error");
        setMsg(e?.response?.data?.message || "Error buscando huésped.");
      }
    }, 350);

    return () => clearTimeout(timerRef.current);
  }, [key]);

  const badge = () => {
    if (estado === "loading") return <span className="badge text-bg-secondary">Buscando…</span>;
    if (estado === "found") return <span className="badge text-bg-success">Encontrado</span>;
    if (estado === "not_found") return <span className="badge text-bg-warning">No existe</span>;
    if (estado === "error") return <span className="badge text-bg-danger">Error</span>;
    return null;
  };

  return (
    <div className="card border-0" style={{ background: "#f8fafc" }}>
      <div className="card-body">
        <div className="d-flex align-items-center justify-content-between">
          <div className="fw-semibold">Buscar huésped (autocompletar)</div>
          {badge()}
        </div>

        <div className="row g-2 mt-2">
          <div className="col-md-4">
            <label className="form-label">Tipo doc.</label>
            <select
              className="form-select"
              value={tipo}
              onChange={(e) => onChange({ ...value, tipo_documento: e.target.value })}
            >
              {TIPOS_DOC.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-md-8">
            <label className="form-label">Documento</label>
            <input
              className="form-control"
              value={documento}
              onChange={(e) => onChange({ ...value, documento: e.target.value })}
              placeholder="Escribe el documento…"
            />
            <div className="form-text">{msg || "Al escribir el documento, se llenarán los datos automáticamente."}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
