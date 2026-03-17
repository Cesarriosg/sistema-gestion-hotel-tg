// src/services/bloqueosService.js
import api from "./api";

const bloqueosService = {
  calendario:  ()        => api.get("/bloqueos/calendario"),
  crear:       (body)    => api.post("/bloqueos", body),
  eliminar:    (id)      => api.delete(`/bloqueos/${id}`),
  actualizar:  (id,body) => api.put(`/bloqueos/${id}`, body),
};

export default bloqueosService;