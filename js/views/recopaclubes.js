// Vista: Recopa Sudamericana de Clubes. Usa el módulo compartido copa_internacional.
// Datos: data/recopaclubes.json (parseado de RSSSF, scripts/copas_mini_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'recopaclubes', campKey: 'recopaclubes_campeones',
    titulo: 'Recopa Sudamericana de Clubes', comp: 'Recopa Sudamericana de Clubes',
    rango: '1970', script: 'copas_mini_parse.py',
  });
}
