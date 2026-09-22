// Vista: Copa Sudamericana (2002–). Usa el módulo compartido copa_internacional.
// Datos: data/sudamericana.json (parseado de RSSSF sacups/, scripts/sudamericana_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'sudamericana', campKey: 'sudamericana_campeones',
    titulo: 'Copa Sudamericana', comp: 'Copa Sudamericana',
    rango: '2002–2024', script: 'sudamericana_parse.py',
    // 2016: la final no se jugó (tragedia de Chapecoense); el título se otorgó a Chapecoense y Atlético
    // Nacional, su rival en la final, figura como subcampeón.
    subcampeon: {'2016': 'Atlético Nacional (Colombia)'},
  });
}
