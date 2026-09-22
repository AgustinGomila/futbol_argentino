// Vista: Cup Tie Competition — Copa de Competencia Chevallier Boutell (1900–1919). Usa el módulo
// compartido copa_internacional. Datos: data/cuptie.json (parser scripts/cuptie_parse.py). Se muestran
// las FINALES (el partido que definía el título) entre los campeones de Buenos Aires, Rosario y Montevideo.

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'cuptie', campKey: 'cuptie_campeones',
    titulo: 'Cup Tie Competition (Chevallier Boutell)', comp: 'Cup Tie Competition',
    rango: '1900–1919', script: 'cuptie_parse.py',
  });
}
