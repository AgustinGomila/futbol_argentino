// Vista: Copa Aldao — Campeonato Rioplatense (1913–1957). Usa el módulo compartido copa_internacional.
// Datos: data/aldao.json (parseado de RSSSF sacups/aldaodet.html, scripts/aldao_parse.py). Final (1–2
// legs) entre el campeón argentino y el uruguayo. Las ediciones no oficiales/no finalizadas se muestran
// pero no suman al palmarés (flag no_of).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'aldao', campKey: 'aldao_campeones',
    titulo: 'Copa Aldao (Campeonato Rioplatense)', comp: 'Copa Aldao',
    rango: '1913–1957', script: 'aldao_parse.py',
  });
}
