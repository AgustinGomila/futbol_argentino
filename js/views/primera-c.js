// Vista: Primera C Metropolitana (cuarto nivel AFA, clubes directamente afiliados). Es la misma vista que la Tabla
// histórica de Primera (tabla-historica.js) con los JSON de la categoría. Datos: data/cuarta_*.json, generados partido
// a partido desde el cache RSSSF (scripts/cuarta_parse.py -> data/cuarta.csv -> build_web.py vía segunda_build).

import {render as renderTabla} from './tabla-historica.js';

export const PRIMERA_C = {
  titulo: 'Primera C',
  json: {
    torneos: 'cuarta_torneos', posiciones: 'cuarta_posiciones', campeones: 'cuarta_campeones',
    definiciones: 'cuarta_definiciones', series: 'cuarta_series', liguillas: null,
    partidos: 'cuarta_partidos', rondas: 'cuarta_rondas', incidencias: 'cuarta_incidencias',
  },
  totalAllTime: 'TOTAL_CUARTA',
  totalesGenerales: ['TOTAL_CUARTA'],
  palmares: true,   // botón Palmarés (campeones de la categoría) en la barra de opciones
  iconoLiga: '_cuarta',   // trofeo por defecto de los torneos de la C (fila '*cuarta' de torneos_meta.csv)
};

export async function render(container, params = {}) {
  await renderTabla(container, params, PRIMERA_C);
}
