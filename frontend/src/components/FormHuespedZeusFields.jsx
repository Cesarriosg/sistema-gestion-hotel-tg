import { Row, Col, Form } from "react-bootstrap";

export default function FormHuespedZeusFields({ value, onChange, disabled = false }) {
  // value = objeto huésped
  // onChange = (patch) => setValue(prev => ({...prev, ...patch}))
  const set = (k) => (e) => onChange({ [k]: e.target.value });

  return (
    <>
      {/* Documento / Tipo / Nombres */}
      <Row className="g-3">
        <Col md={3}>
          <Form.Group>
            <Form.Label>Tipo Doc.</Form.Label>
            <Form.Select value={value.tipo_documento || ""} onChange={set("tipo_documento")} disabled={disabled}>
              <option value="">(Seleccionar)</option>
              <option value="CC">CC</option>
              <option value="CE">CE</option>
              <option value="TI">TI</option>
              <option value="PAS">Pasaporte</option>
              <option value="NIT">NIT</option>
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={3}>
          <Form.Group>
            <Form.Label>Documento</Form.Label>
            <Form.Control
              value={value.documento || ""}
              onChange={set("documento")}
              disabled={disabled}
              placeholder="Ej: 123456789"
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group>
            <Form.Label>Nombres *</Form.Label>
            <Form.Control
              value={value.nombres || ""}
              onChange={set("nombres")}
              disabled={disabled}
              placeholder="Ej: Carlos Andrés"
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Apellidos */}
      <Row className="g-3 mt-0">
        <Col md={6}>
          <Form.Group>
            <Form.Label>Primer apellido *</Form.Label>
            <Form.Control
              value={value.primer_apellido || ""}
              onChange={set("primer_apellido")}
              disabled={disabled}
              placeholder="Ej: Cruz"
            />
          </Form.Group>
        </Col>

        <Col md={6}>
          <Form.Group>
            <Form.Label>Segundo apellido</Form.Label>
            <Form.Control
              value={value.segundo_apellido || ""}
              onChange={set("segundo_apellido")}
              disabled={disabled}
              placeholder="Opcional"
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Fechas */}
      <Row className="g-3 mt-0">
        <Col md={3}>
          <Form.Group>
            <Form.Label>Fecha nacimiento</Form.Label>
            <Form.Control
              type="date"
              value={value.fecha_nacimiento || ""}
              onChange={set("fecha_nacimiento")}
              disabled={disabled}
            />
          </Form.Group>
        </Col>

        <Col md={3}>
          <Form.Group>
            <Form.Label>Fecha expedición</Form.Label>
            <Form.Control
              type="date"
              value={value.fecha_expedicion || ""}
              onChange={set("fecha_expedicion")}
              disabled={disabled}
            />
          </Form.Group>
        </Col>

        <Col md={3}>
          <Form.Group>
            <Form.Label>Teléfono</Form.Label>
            <Form.Control
              value={value.telefono || ""}
              onChange={set("telefono")}
              disabled={disabled}
              placeholder="Ej: 3001234567"
            />
          </Form.Group>
        </Col>

        <Col md={3}>
          <Form.Group>
            <Form.Label>Email</Form.Label>
            <Form.Control
              type="email"
              value={value.email || ""}
              onChange={set("email")}
              disabled={disabled}
              placeholder="correo@..."
            />
          </Form.Group>
        </Col>
      </Row>

      {/* Ubicación */}
      <Row className="g-3 mt-0">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Nacionalidad</Form.Label>
            <Form.Control
              value={value.nacionalidad || ""}
              onChange={set("nacionalidad")}
              disabled={disabled}
              placeholder="Ej: Colombiana"
            />
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label>Ciudad</Form.Label>
            <Form.Control
              value={value.ciudad || ""}
              onChange={set("ciudad")}
              disabled={disabled}
              placeholder="Ej: Cali"
            />
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label>Dirección</Form.Label>
            <Form.Control
              value={value.direccion || ""}
              onChange={set("direccion")}
              disabled={disabled}
              placeholder="Ej: Cra 10 # 20-30"
            />
          </Form.Group>
        </Col>
      </Row>
    </>
  );
}
