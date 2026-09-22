// Vista: Supercopa Sudamericana / Supercopa Libertadores (1988–1997). Usa el módulo compartido
// copa_internacional. Datos: data/supercopa.json (finales parseadas de RSSSF sacups/sasup.html,
// scripts/supercopa_parse.py). Se disputaba entre ex-campeones de la Copa Libertadores.

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'supercopa', campKey: 'supercopa_campeones',
    titulo: 'Supercopa Sudamericana', comp: 'Supercopa Sudamericana',
    rango: '1988–1997', script: 'supercopa_parse.py',
  });
}
