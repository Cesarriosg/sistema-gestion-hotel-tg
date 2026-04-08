// src/services/habitacionesService.js
import api from "./api";

const habitacionesService = {
  listar:          (params)    => api.get("/habitaciones", { params }),
  obtener:         (id)        => api.get(`/habitaciones/${id}`),
  crear:           (body)      => api.post("/habitaciones", body),
  actualizar:      (id, body)  => api.put(`/habitaciones/${id}`, body),
  cambiarEstado:   (id, body)  => api.put(`/habitaciones/${id}/estado`, body),
  actualizarNotas: (id, notas) => api.put(`/habitaciones/${id}/notas`, { notas }),
  tipos:           ()          => api.get("/tipos-habitacion"),
};

export default habitacionesService;