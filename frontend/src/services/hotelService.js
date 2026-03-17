// src/services/hotelService.js
import api from "./api";

const hotelService = {
  dashboard:        ()      => api.get("/dashboard"),
  fechaSistema:     ()      => api.get("/fecha-sistema"),
  config:           ()      => api.get("/config"),
  actualizarConfig: (body)  => api.put("/config", body),
  avanzarFecha:     ()      => api.post("/config/avanzar-fecha"),
  ejecutarCierreDia: ()     => api.post("/auditoria/cierre-dia"),
  previewCierre:    ()      => api.get("/auditoria/preview-alojamiento"),
  actualizarFecha:  (body)  => api.put("/hotel/fecha-sistema", body),
  notificaciones:   ()      => api.get("/notificaciones"),
  marcarLeidas:     ()      => api.put("/notificaciones/leer"),
};

export default hotelService;