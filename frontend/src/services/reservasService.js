// src/services/reservasService.js
import api from "./api";

const reservasService = {
  // Consultas
  listar:            (params)   => api.get("/reservas", { params }),
  obtener:           (id)       => api.get(`/reservas/${id}`),
  obtenerRegistro:   (id)       => api.get(`/reservas/${id}/registro-hotelero`, { responseType: "blob" }),
  obtenerFinanzas:   (id)       => api.get(`/reservas/${id}/finanzas`),
  obtenerHuespedes:  (id)       => api.get(`/reservas/${id}/huespedes-asociados`),
  calendario:        ()         => api.get("/reservas/calendario"),
  llegadasHoy:       ()         => api.get("/reservas/llegadas-hoy"),
  habitacionesDisp:  (params)   => api.get("/reservas/disponibles", { params }),
  previsualizar:     (params)   => api.get("/reservas/previsualizar-precio", { params }),

  // Mutaciones
  crear:             (body)     => api.post("/reservas", body),
  actualizar:        (id, body) => api.put(`/reservas/${id}`, body),
  cancelar:          (id, body) => api.put(`/reservas/${id}/cancelar`, body),
  extender:          (id, body) => api.post(`/reservas/${id}/extender`, body),
  checkin:           (id, body) => api.post(`/reservas/${id}/checkin`, body),
  checkout:          (id, body) => api.post(`/reservas/${id}/checkout`, body),
  facturar:          (id, body) => api.post(`/reservas/${id}/facturar`, body),
  actualizarAcomp:   (id, body) => api.put(`/reservas/${id}/acompanantes`, body),
  agregarCargo:      (id, body) => api.post(`/reservas/${id}/pagos`, body),
  noShow:            (id, body) => api.post(`/reservas/${id}/no-show`, body),
  historial:         (id)       => api.get(`/reservas/${id}/historial`),
  previsualizarPrecio: (params)  => api.get("/reservas/previsualizarPrecioReserva", { params }),
  datosCheckin:      (id)       => api.get(`/reservas/${id}/checkin/data`),
  llegadas:          (params)   => api.get("/reservas/llegadas", { params }),
};

export default reservasService;