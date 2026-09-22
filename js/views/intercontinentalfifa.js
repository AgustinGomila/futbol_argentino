// Vista: Copa Intercontinental de la FIFA (2024–). Usa el módulo compartido copa_internacional.
// Datos: data/intercontinentalfifa.json (parseado de RSSSF tablesf/fifa-icc*, scripts/mundialclubes_parse.py).
// Torneo anual entre los campeones continentales: el campeón de Europa espera en la final.

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'intercontinentalfifa', campKey: 'intercontinentalfifa_campeones',
    titulo: 'Copa Intercontinental de la FIFA', comp: 'Copa Intercontinental de la FIFA',
    rango: '2024–2025', script: 'mundialclubes_parse.py',
  });
}
