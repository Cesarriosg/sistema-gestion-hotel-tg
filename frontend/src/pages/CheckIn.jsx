import { useEffect, useState } from "react";
import axios from "axios";
import { useParams, useNavigate } from "react-router-dom";

export default function CheckIn() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [titular, setTitular] = useState({ nombre: "", documento: "", telefono: "" });
  const [acompanantes, setAcompanantes] = useState([]);
  const [habitacion, setHabitacion] = useState({});
  const [error, setError] = useState("");

  useEffect(() => {
  const cargar = async () => {
    try {
      const r = await axios.get(`http://localhost:4000/api/reservas/${id}/checkin/data`);
      setTitular({
        nombre: r.data.nombre,
        documento: r.data.documento,
        telefono: r.data.telefono
      });
      setHabitacion({
        numero: r.data.habitacion_numero,
        tipo: r.data.tipo
      });
    } catch (error) {
      setError("Error cargando datos.");
    }
  };

  cargar();
}, [id]);


  // Buscar huésped existente automáticamente
  const buscarHuesped = async (doc) => {
    try {
      const r = await axios.get(`http://localhost:4000/api/huespedes/documento/${doc}`);
      if (r.data) {
        setTitular({
          nombre: r.data.nombre,
          documento: r.data.documento,
          telefono: r.data.telefono
        });
      }
    } catch { }
  };

  const agregarAcompanante = () => {
    setAcompanantes([...acompanantes, { nombre: "", edad: "" }]);
  };

  const registrarCheckIn = async () => {
    try {
      await axios.post(`http://localhost:4000/api/reservas/${id}/checkin`, {
        titular,
        acompanantes
      });
      navigate("/panel");
    } catch (e) {
      setError("No se pudo completar el check-in");
    }
  };

  return (
    <div className="contenedor-form">
      <h2>Check-In — Hab {habitacion.numero}</h2>

      {error && <p className="error">{error}</p>}

      <label>Documento (titular)</label>
      <input
        value={titular.documento}
        onChange={(e) => {
          setTitular({ ...titular, documento: e.target.value });
          buscarHuesped(e.target.value);
        }}
      />

      <label>Nombre completo</label>
      <input
        value={titular.nombre}
        onChange={(e) => setTitular({ ...titular, nombre: e.target.value })}
      />

      <label>Teléfono</label>
      <input
        value={titular.telefono}
        onChange={(e) => setTitular({ ...titular, telefono: e.target.value })}
      />

      <h3>Acompañantes</h3>

      {acompanantes.map((a, index) => (
        <div key={index} className="acompanante">
          <input
            placeholder="Nombre"
            value={a.nombre}
            onChange={(e) => {
              const copia = [...acompanantes];
              copia[index].nombre = e.target.value;
              setAcompanantes(copia);
            }}
          />
          <input
            placeholder="Edad"
            value={a.edad}
            onChange={(e) => {
              const copia = [...acompanantes];
              copia[index].edad = e.target.value;
              setAcompanantes(copia);
            }}
          />
        </div>
      ))}

      <button onClick={agregarAcompanante}>➕ Agregar Acompañante</button>

      <button className="btn-primary w-100" onClick={registrarCheckIn}>
        Confirmar Check-In ✅
      </button>
    </div>
  );
}
