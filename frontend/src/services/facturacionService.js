// src/services/facturacionService.js
import api from "./api";

const facturacionService = {
  obtener:  (id)  => api.get(`/facturacion/${id}`),
  listar:   ()    => api.get("/facturacion"),
  anular:   (id)  => api.put(`/facturacion/${id}/anular`),
};

export default facturacionService;