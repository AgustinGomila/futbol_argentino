// Vista: Copa de Oro. Usa el módulo compartido copa_internacional.
// Datos: data/oro.json (parseado de RSSSF, scripts/copas_mini_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'oro', campKey: 'oro_campeones',
    titulo: 'Copa de Oro', comp: 'Copa de Oro',
    rango: '1993–1996', script: 'copas_mini_parse.py',
  });
}
