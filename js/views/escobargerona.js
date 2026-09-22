// Vista: Copa de Confraternidad Escobar-Gerona (1941–1946). Usa el módulo compartido copa_internacional.
// Datos: data/escobargerona.json (parser scripts/escobargerona_parse.py). Final (1–2 legs) entre los
// SUBCAMPEONES de las ligas argentina y uruguaya. Ediciones no oficiales/no definidas: flag no_of.

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'escobargerona', campKey: 'escobargerona_campeones',
    titulo: 'Copa de Confraternidad Escobar-Gerona', comp: 'Copa Escobar-Gerona',
    rango: '1941–1946', script: 'escobargerona_parse.py',
  });
}
