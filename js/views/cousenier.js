// Vista: Copa de Honor Cousenier (1905–1920). Usa el módulo compartido copa_internacional.
// Datos: data/cousenier.json (parser scripts/cousenier_parse.py). Final (a veces con desempate) entre
// equipos de Uruguay, Argentina (AFA) y la Liga Rosarina; se jugaba en Montevideo.

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'cousenier', campKey: 'cousenier_campeones',
    titulo: 'Copa de Honor Cousenier', comp: 'Copa de Honor Cousenier',
    rango: '1905–1920', script: 'cousenier_parse.py',
  });
}
