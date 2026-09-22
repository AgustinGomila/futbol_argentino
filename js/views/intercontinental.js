// Vista: Copa Intercontinental. Usa el módulo compartido copa_internacional.
// Datos: data/intercontinental.json (parseado de RSSSF, scripts/copas_mini_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'intercontinental', campKey: 'intercontinental_campeones',
    titulo: 'Copa Intercontinental', comp: 'Copa Intercontinental',
    rango: '1960–2004', script: 'copas_mini_parse.py',
  });
}
