// src/services/serviciosService.js
import api from "./api";

const serviciosService = {
  // Catálogo (RF-20)
  listar:          ()          => api.get("/servicios"),
  obtener:         (id)        => api.get(`/servicios/${id}`),
  crear:           (body)      => api.post("/servicios", body),
  actualizar:      (id, body)  => api.put(`/servicios/${id}`, body),
  eliminar:        (id)        => api.delete(`/servicios/${id}`),

  // Consumos por reserva
  listarConsumos:   (reservaId) => api.get(`/servicios-consumidos/${reservaId}`),
  registrarConsumo: (body)      => api.post("/servicios-consumidos", body),
  eliminarConsumo:  (id)        => api.delete(`/servicios-consumidos/${id}`),
};

export default serviciosService;