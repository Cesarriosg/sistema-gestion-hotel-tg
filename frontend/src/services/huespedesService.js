// src/services/huespedesService.js
import api from "./api";

const huespedesService = {
  listar:          (params)    => api.get("/huespedes", { params }),
  obtener:         (id)        => api.get(`/huespedes/${id}`),
  historial:       (id)        => api.get(`/huespedes/${id}/historial`),
  buscar:          (params)    => api.get("/huespedes/buscar", { params }),
  crear:           (body)      => api.post("/huespedes", body),
  actualizar:      (id, body)  => api.put(`/huespedes/${id}`, body),
  estadias:        (id)         => api.get(`/huespedes/${id}/estadias`),
};

export default huespedesService;