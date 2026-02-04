// src/utils/fechaOperativa.js
export const getFechaOperativa = async (client) => {
  const r = await client.query("SELECT fecha_sistema FROM configuracion LIMIT 1");
  const fecha = r.rows?.[0]?.fecha_sistema;

  if (!fecha) {
    throw new Error("No hay fecha_sistema configurada en la tabla configuracion.");
  }

  // devuelve tipo date o string YYYY-MM-DD (Postgres suele devolver YYYY-MM-DD)
  return fecha;
};
