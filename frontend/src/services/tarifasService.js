// src/services/tarifasService.js
import api from "./api";

const tarifasService = {
  listarPlanes:  ()           => api.get("/tarifas/planes"),
  resumen:       ()           => api.get("/tarifas/resumen"),
  listar:        (params)     => api.get("/tarifas", { params }),
  obtener:       (id)         => api.get(`/tarifas/${id}`),
  crear:         (body)       => api.post("/tarifas", body),
  actualizar:    (id, body)   => api.put(`/tarifas/${id}`, body),
  eliminar:      (id)         => api.delete(`/tarifas/${id}`),
};

export default tarifasService;