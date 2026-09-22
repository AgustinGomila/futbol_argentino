// Vista: Copa Sudamericana (2002–). Usa el módulo compartido copa_internacional.
// Datos: data/sudamericana.json (parseado de RSSSF sacups/, scripts/sudamericana_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'sudamericana', campKey: 'sudamericana_campeones',
    titulo: 'Copa Sudamericana', comp: 'Copa Sudamericana',
    rango: '2002–2024', script: 'sudamericana_parse.py',
  });
}
