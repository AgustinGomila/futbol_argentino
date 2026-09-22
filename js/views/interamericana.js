// Vista: Copa Interamericana (1968–1998). Usa el módulo compartido copa_internacional.
// Datos: data/interamericana.json (parseado de RSSSF tablesi/intam.html, scripts/interamericana_parse.py).
// Final de 2–3 legs entre el campeón de la Copa Libertadores y el de la Copa CONCACAF.

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'interamericana', campKey: 'interamericana_campeones',
    titulo: 'Copa Interamericana', comp: 'Copa Interamericana',
    rango: '1968–1998', script: 'interamericana_parse.py',
  });
}
