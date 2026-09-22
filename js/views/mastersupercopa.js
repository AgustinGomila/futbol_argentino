// Vista: Copa Máster de Supercopa. Usa el módulo compartido copa_internacional.
// Datos: data/mastersupercopa.json (parseado de RSSSF, scripts/copas_mini_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'mastersupercopa', campKey: 'mastersupercopa_campeones',
    titulo: 'Copa Máster de Supercopa', comp: 'Copa Máster de Supercopa',
    rango: '1992–1994', script: 'copas_mini_parse.py',
  });
}
