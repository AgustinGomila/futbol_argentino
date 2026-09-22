// Vista: Copa Conmebol Masters. Usa el módulo compartido copa_internacional.
// Datos: data/conmebolmasters.json (parseado de RSSSF, scripts/copas_mini_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'conmebolmasters', campKey: 'conmebolmasters_campeones',
    titulo: 'Copa Conmebol Masters', comp: 'Copa Conmebol Masters',
    rango: '1996', script: 'copas_mini_parse.py',
  });
}
