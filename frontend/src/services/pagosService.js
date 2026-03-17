// src/services/pagosService.js
import api from "./api";

const pagosService = {
  registrar:   (body) => api.post("/pagos", body),
  porReserva:  (id)   => api.get(`/pagos/reserva/${id}`),
};

export default pagosService;