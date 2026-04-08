// src/services/reportesService.js
import api from "./api";

const reportesService = {
  meta:          ()        => api.get("/reportes/meta"),
  resumen:       (params)  => api.get("/reportes/resumen",               { params }),
  ocupacion:     (params)  => api.get("/reportes/ocupacion",             { params }),
  ingresos:      (params)  => api.get("/reportes/ingresos",              { params }),
  frecuentes:    (params)  => api.get("/reportes/huespedes-frecuentes",  { params }),
  habitaciones:  (params)  => api.get("/reportes/habitaciones",          { params }),
};

export default reportesService;