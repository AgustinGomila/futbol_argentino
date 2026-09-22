// Tercera división: Primera B Metropolitana (AFA, 1986/87–2026) y Torneo Federal A (CFFA, 1995/96–2026; Torneo
// Argentino A hasta 2013/14). Cada torneo tiene su vista (primera-b-metro.js / federal-a.js, en el desplegable "Divisiones de Ascenso"):
// la misma Tabla histórica (tabla-historica.js) con los JSON de la categoría, filtrada a los torneos de ese certamen y
// con su propio total. #/tercera queda para los enlaces que solo saben la categoría (ficha del club, Resumen, gráfico
// de posiciones): con ?t=<torneo> redirige a la vista del certamen; sin torneo, muestra los dos juntos.
// Datos: data/tercera_*.json, generados partido a partido desde el cache RSSSF (scripts/tercera_parse.py ->
// data/tercera.csv -> build_web.py vía segunda_build).

import {render as renderTabla} from './tabla-historica.js';

const JSON_TERCERA = {
  torneos: 'tercera_torneos', posiciones: 'tercera_posiciones', campeones: 'tercera_campeones',
  definiciones: 'tercera_definiciones', series: 'tercera_series', liguillas: null,
  partidos: 'tercera_partidos', rondas: 'tercera_rondas', incidencias: 'tercera_incidencias',
};
const ICONO = '_tercera';   // trofeo por defecto de los torneos de Tercera (fila '*tercera' de torneos_meta.csv)

export const TERCERA = {
  titulo: 'Tercera división', json: JSON_TERCERA, iconoLiga: ICONO,
  totalAllTime: 'TOTAL_TERCERA', totalesGenerales: ['TOTAL_TERCERA'], palmares: true,
};
export const PRIMERA_B_METRO = {
  titulo: 'Primera B Metropolitana', json: JSON_TERCERA, iconoLiga: ICONO,
  totalAllTime: 'TOTAL_TERCERA_BM', totalesGenerales: ['TOTAL_TERCERA_BM'], palmares: true,
  filtro: (t) => (t.grupo || t.id).startsWith('Tercera_BM_') || t.id === 'TOTAL_TERCERA_BM',
};
export const FEDERAL_A = {
  titulo: 'Torneo Federal A', json: JSON_TERCERA, iconoLiga: ICONO,
  totalAllTime: 'TOTAL_TERCERA_FA', totalesGenerales: ['TOTAL_TERCERA_FA'], palmares: true,
  filtro: (t) => (t.grupo || t.id).startsWith('Tercera_FA_') || t.id === 'TOTAL_TERCERA_FA',
};

// Ruta de la vista de un torneo de Tercera por su id ('Tercera_BM_2025' -> '#/primera-b-metro').
export function rutaTercera(gid) {
  return /^Tercera_FA_|^TOTAL_TERCERA_FA$/.test(gid || '') ? '#/federal-a' : '#/primera-b-metro';
}

export async function render(container, params = {}) {
  if (params.t) {   // enlace a un torneo puntual: a la vista de su certamen (reemplaza la entrada del historial)
    const q = new URLSearchParams(params).toString();
    location.replace(`${rutaTercera(params.t)}?${q}`);
    return;
  }
  await renderTabla(container, params, TERCERA);
}
