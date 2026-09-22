// Capa de datos. Sin build: el navegador consume JSON precomputado desde /data.
// Los JSON se generan desde los CSV canonicos (data/*.csv) con scripts/build_web.py
// (Fase 3). Aca solo va el acceso y un cache en memoria.

const DATA_DIR = 'data';
const cache = new Map();

/** Carga y cachea un JSON de /data. Devuelve null si aun no fue generado. */
export async function loadJSON(name) {
  if (cache.has(name)) return cache.get(name);
  const res = await fetch(`${DATA_DIR}/${name}.json`);
  if (!res.ok) {
    console.warn(`Dataset "${name}" no disponible todavia (${res.status}).`);
    cache.set(name, null);
    return null;
  }
  const json = await res.json();
  cache.set(name, json);
  return json;
}
