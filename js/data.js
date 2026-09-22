// Capa de datos. Sin build: el navegador consume JSON precomputado desde /data.
// Los JSON se generan desde los CSV canonicos (data/*.csv) con scripts/build_web.py
// (Fase 3). Aca solo va el acceso y un cache en memoria.

const DATA_DIR = 'data';
const cache = new Map();

/** Carga y cachea un JSON de /data. Devuelve null si aun no fue generado. */
export async function loadJSON(name) {
  if (cache.has(name)) return cache.get(name);
  // cache: 'no-cache' -> el navegador REVALIDA cada JSON con el servidor (304 si no cambió). Sin esto, el cache
  // heurístico puede servir una versión vieja de un archivo y nueva de otro tras un rebuild (ej. un
  // segunda_campeones.json viejo ocultaba del desplegable los torneos nuevos de segunda_torneos.json).
  const res = await fetch(`${DATA_DIR}/${name}.json`, {cache: 'no-cache'});
  if (!res.ok) {
    console.warn(`Dataset "${name}" no disponible todavia (${res.status}).`);
    cache.set(name, null);
    return null;
  }
  const json = await res.json();
  cache.set(name, json);
  return json;
}
