// Identidad y ETIQUETA de clubes, derivadas de registro.json (una sola fuente para todas las vistas).
// El VÍNCULO/navegación es SIEMPRE el id único; el nombre MOSTRADO es una etiqueta curable
// (registro.nombre_comun) desacoplada del nombre CANÓNICO, que sigue siendo la clave de join de los
// datasets (partidos/posiciones/copas/libertadores/sudamericana...). Por eso ambos mapas van keyed por
// el nombre canónico: es lo que traen esos datos. Editar el nombre común de un club = cambiar 1 campo en
// clubes.json (→ registro_meta → registro.json), sin mover el id ni re-canonizar nada.
export function clubIndex(registro) {
  const idDe = {};      // nombre canónico -> id (para enlazar con clubHref)
  const label = {};     // nombre canónico -> nombre común a mostrar
  for (const [cid, c] of Object.entries(registro || {})) {
    idDe[c.nombre] = cid;
    label[c.nombre] = c.nombre_comun || c.nombre;
  }
  return {idDe, label: (n) => label[n] || n};   // label(canónico) -> nombre común (fallback: el propio n)
}

// Mapa de FUSIÓN de denominaciones: nombre canónico del ORIGEN -> nombre canónico del DESTINO. Se deriva
// de registro.json (campo `fusion` = id del destino, por club), reemplazando al viejo fusiones.json. Los
// datos siguen keyed por NOMBRE, así que la agregación (Tabla histórica / Copas históricas / ficha) usa
// nombres; el vínculo curado en clubes.json es por ID. Origen sin `fusion` -> no aparece (no se fusiona).
export function fusionNombre(registro) {
  const id2name = {}, map = {};
  for (const [id, c] of Object.entries(registro || {})) id2name[id] = c.nombre;
  for (const c of Object.values(registro || {})) {
    if (c.fusion && id2name[c.fusion]) map[c.nombre] = id2name[c.fusion];
  }
  return map;   // {nombreOrigen -> nombreDestino}
}
