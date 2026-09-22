// Vista: Suruga Bank Championship (2008–2019). Usa el módulo compartido copa_internacional.
// Datos: data/suruga.json (parseado de RSSSF tabless/suruga08.html, scripts/suruga_parse.py).
// Un solo partido por edición entre el campeón de la Copa Sudamericana y el de la J.League Cup
// (Yamazaki Nabisco / YBC Levain Cup). En 2019 se disputó como I Levain Cup.

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'suruga', campKey: 'suruga_campeones',
    titulo: 'Suruga Bank Championship', comp: 'Suruga Bank Championship',
    rango: '2008–2019', script: 'suruga_parse.py',
  });
}
