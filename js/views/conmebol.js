// Vista: Copa Conmebol (1992–1999). Usa el módulo compartido copa_internacional.
// Datos: data/conmebol.json (parseado de RSSSF sacups/conmebolNN.html, scripts/conmebol_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'conmebol', campKey: 'conmebol_campeones',
    titulo: 'Copa Conmebol', comp: 'Copa Conmebol',
    rango: '1992–1999', script: 'conmebol_parse.py',
  });
}
