// Vista: Recopa Sudamericana (1988–). Usa el módulo compartido copa_internacional.
// Datos: data/recopa.json (parseado de RSSSF sacups/recopa.html, scripts/recopa_parse.py).
// Solo la Final de cada edición (1–2 legs) entre el campeón de la Libertadores y el de la Sudamericana
// (antes: Supercopa / Copa Conmebol).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'recopa', campKey: 'recopa_campeones',
    titulo: 'Recopa Sudamericana', comp: 'Recopa Sudamericana',
    rango: '1988–2025', script: 'recopa_parse.py',
  });
}
