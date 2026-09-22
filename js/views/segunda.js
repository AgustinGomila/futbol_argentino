// Vista: Segunda división (Primera B Nacional / Primera Nacional). Es la misma vista que la Tabla histórica de
// Primera (tabla-historica.js) con los JSON de la categoría. Datos: data/segunda_*.json, generados
// partido a partido desde el cache RSSSF (scripts/segunda_parse.py -> data/segunda.csv -> build_web.py).

import {render as renderTabla} from './tabla-historica.js';

const SEGUNDA = {
  titulo: 'Segunda división',
  json: {
    torneos: 'segunda_torneos', posiciones: 'segunda_posiciones', campeones: 'segunda_campeones',
    definiciones: 'segunda_definiciones', series: 'segunda_series', liguillas: null,
    partidos: 'segunda_partidos', rondas: 'segunda_rondas', incidencias: 'segunda_incidencias',
  },
  totalAllTime: 'TOTAL_SEGUNDA',
  totalesGenerales: ['TOTAL_SEGUNDA'],
};

export async function render(container, params = {}) {
  await renderTabla(container, params, SEGUNDA);
}
