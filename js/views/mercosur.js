// Vista: Copa Mercosur (1998–2001). Usa el módulo compartido copa_internacional.
// Datos: data/mercosur.json (parseado de RSSSF sacups/mercosurNN.html, scripts/mercosur_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'mercosur', campKey: 'mercosur_campeones',
    titulo: 'Copa Mercosur', comp: 'Copa Mercosur',
    rango: '1998–2001', script: 'mercosur_parse.py',
  });
}
