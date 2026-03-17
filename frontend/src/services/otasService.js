// src/services/otasService.js
import api from "./api";

const otasService = {
  // Config por canal
  getConfig:    (canal)        => api.get(`/otas/config/${canal}`),
  setConfig:    (canal, body)  => api.put(`/otas/config/${canal}`, body),

  // Estadísticas
  stats:        (params)       => api.get("/otas/stats/reservas", { params }),

  // Log de sincronizaciones RF-16/17
  syncLog:      (params)       => api.get("/otas/sync-log", { params }),

  // Sandbox (pruebas)
  sandboxCrear:    (body)      => api.post("/otas/sandbox/reserva",          body, { headers: { "x-ota-secret": process.env.REACT_APP_OTA_SECRET || "hotel_tg_secret_2024" } }),
  sandboxCancelar: (body)      => api.post("/otas/sandbox/reserva/cancelar", body, { headers: { "x-ota-secret": process.env.REACT_APP_OTA_SECRET || "hotel_tg_secret_2024" } }),
};

export default otasService;