
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Button, Badge, Form, Modal } from "react-bootstrap";

const API = "http://localhost:4000";

const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "recepcionista", label: "Recepcionista" },
];

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");

  // modal crear/editar
  const [showForm, setShowForm] = useState(false);
  const [modo, setModo] = useState("crear"); // crear | editar
  const [usuarioSel, setUsuarioSel] = useState(null);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState("recepcionista");
  const [estado, setEstado] = useState(true);

  // password solo en crear
  const [password, setPassword] = useState("");

  // reset password modal
  const [showReset, setShowReset] = useState(false);
  const [resetPass, setResetPass] = useState("");
  const [resetUser, setResetUser] = useState(null);

  const cargar = async () => {
    try {
      setLoading(true);
      const r = await axios.get(`${API}/api/usuarios`, { headers: getAuthHeaders() });
      setUsuarios(Array.isArray(r.data) ? r.data : []);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || "No se pudieron cargar usuarios.");
      setUsuarios([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return usuarios;
    return usuarios.filter((u) => {
      const s = `${u.nombre} ${u.email} ${u.rol}`.toLowerCase();
      return s.includes(t);
    });
  }, [usuarios, q]);

  const badgeRol = (r) => {
    if (String(r).toLowerCase() === "admin") return <Badge bg="dark">admin</Badge>;
    return <Badge bg="secondary">recepcionista</Badge>;
  };

  const badgeEstado = (est) => {
    const ok = Boolean(est);
    return <Badge bg={ok ? "success" : "danger"}>{ok ? "Activo" : "Inactivo"}</Badge>;
  };

  const abrirCrear = () => {
    setModo("crear");
    setUsuarioSel(null);
    setNombre("");
    setEmail("");
    setRol("recepcionista");
    setEstado(true);
    setPassword("");
    setShowForm(true);
  };

  const abrirEditar = (u) => {
    setModo("editar");
    setUsuarioSel(u);
    setNombre(u?.nombre || "");
    setEmail(u?.email || "");
    setRol(u?.rol || "recepcionista");
    setEstado(Boolean(u?.estado));
    setPassword("");
    setShowForm(true);
  };

  const guardar = async () => {
    const n = nombre.trim();
    const e = email.trim().toLowerCase();

    if (!n) return alert("Nombre requerido.");
    if (!e) return alert("Email requerido.");
    if (!rol) return alert("Rol requerido.");

    try {
      if (modo === "crear") {
        if (!password || password.length < 6) return alert("Password mínimo 6 caracteres.");

        await axios.post(
          `${API}/api/usuarios`,
          { nombre: n, email: e, rol, estado: Boolean(estado), password },
          { headers: getAuthHeaders() }
        );
      } else {
        await axios.put(
          `${API}/api/usuarios/${usuarioSel.id}`,
          { nombre: n, email: e, rol, estado: Boolean(estado) },
          { headers: getAuthHeaders() }
        );
      }

      setShowForm(false);
      await cargar();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo guardar.");
    }
  };

  const toggleEstado = async (u) => {
    try {
      await axios.patch(
        `${API}/api/usuarios/${u.id}/estado`,
        { estado: !Boolean(u.estado) },
        { headers: getAuthHeaders() }
      );
      await cargar();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo cambiar estado.");
    }
  };

  const eliminar = async (u) => {
    const ok = window.confirm(`¿Eliminar usuario ${u.email}? Esto no se puede deshacer.`);
    if (!ok) return;

    try {
      await axios.delete(`${API}/api/usuarios/${u.id}`, { headers: getAuthHeaders() });
      await cargar();
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo eliminar.");
    }
  };

  const abrirReset = (u) => {
    setResetUser(u);
    setResetPass("");
    setShowReset(true);
  };

  const ejecutarReset = async () => {
    if (!resetUser) return;
    if (!resetPass || resetPass.length < 6) return alert("Nueva contraseña mínimo 6 caracteres.");

    try {
      await axios.patch(
        `${API}/api/usuarios/${resetUser.id}/reset-password`,
        { nueva_password: resetPass },
        { headers: getAuthHeaders() }
      );

      setShowReset(false);
      setResetPass("");
      setResetUser(null);
      alert("Contraseña restablecida.");
    } catch (err) {
      console.error(err);
      alert(err?.response?.data?.message || "No se pudo restablecer contraseña.");
    }
  };

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
        <div>
          <h2 className="mb-0">👥 Gestión de Usuarios</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Crear, editar, asignar rol, activar/inactivar, eliminar y resetear contraseñas.
          </div>
        </div>

        <div className="d-flex gap-2">
          <Button variant="outline-secondary" onClick={cargar} disabled={loading}>
            ↻ Recargar
          </Button>
          <Button variant="primary" onClick={abrirCrear}>
            + Crear usuario
          </Button>
        </div>
      </div>

      <div className="d-flex gap-2 mb-3 flex-wrap">
        <Form.Control
          style={{ maxWidth: 320 }}
          placeholder="Buscar por nombre, email o rol..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="text-muted d-flex align-items-center" style={{ fontSize: 13 }}>
          Total: <b className="ms-1">{usuarios.length}</b>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          {loading ? (
            <div className="text-muted">Cargando...</div>
          ) : lista.length === 0 ? (
            <div className="alert alert-warning mb-0">No hay usuarios para mostrar.</div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm align-middle">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((u) => (
                    <tr key={u.id} style={!u.estado ? { opacity: 0.7 } : undefined}>
                      <td>{u.id}</td>
                      <td>{u.nombre}</td>
                      <td>{u.email}</td>
                      <td>{badgeRol(u.rol)}</td>
                      <td>{badgeEstado(u.estado)}</td>
                      <td className="d-flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline-primary" onClick={() => abrirEditar(u)}>
                          Editar
                        </Button>

                        <Button
                          size="sm"
                          variant={u.estado ? "outline-danger" : "outline-success"}
                          onClick={() => toggleEstado(u)}
                        >
                          {u.estado ? "Desactivar" : "Activar"}
                        </Button>

                        <Button size="sm" variant="outline-dark" onClick={() => abrirReset(u)}>
                          Reset password
                        </Button>

                        <Button size="sm" variant="danger" onClick={() => eliminar(u)}>
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Crear / Editar */}
      <Modal show={showForm} onHide={() => setShowForm(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{modo === "crear" ? "Crear usuario" : "Editar usuario"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form.Group className="mb-2">
            <Form.Label>Nombre</Form.Label>
            <Form.Control value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Email</Form.Label>
            <Form.Control value={email} onChange={(e) => setEmail(e.target.value)} />
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Label>Rol</Form.Label>
            <Form.Select value={rol} onChange={(e) => setRol(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>

          <Form.Group className="mb-2">
            <Form.Check
              type="switch"
              label="Usuario activo"
              checked={estado}
              onChange={(e) => setEstado(e.target.checked)}
            />
          </Form.Group>

          {modo === "crear" && (
            <Form.Group className="mb-2">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="mínimo 6 caracteres"
              />
              <div className="text-muted mt-1" style={{ fontSize: 12 }}>
                En edición no se cambia la contraseña aquí (usa “Reset password”).
              </div>
            </Form.Group>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowForm(false)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar}>
            Guardar
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Modal Reset Password */}
      <Modal show={showReset} onHide={() => setShowReset(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Reset password</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <div className="mb-2">
            Usuario: <b>{resetUser?.email}</b>
          </div>

          <Form.Group>
            <Form.Label>Nueva contraseña</Form.Label>
            <Form.Control
              type="password"
              value={resetPass}
              onChange={(e) => setResetPass(e.target.value)}
              placeholder="mínimo 6 caracteres"
            />
          </Form.Group>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowReset(false)}>
            Cancelar
          </Button>
          <Button variant="dark" onClick={ejecutarReset}>
            Restablecer
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
