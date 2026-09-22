// Vista: Mundial de Clubes de la FIFA (2000, 2005–2023, 2025). Usa el módulo compartido copa_internacional.
// Datos: data/mundialclubes.json (parseado de RSSSF tablesf/, scripts/mundialclubes_parse.py). La Copa
// Intercontinental de la FIFA (2024–) tiene su propia vista (intercontinentalfifa.js).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'mundialclubes', campKey: 'mundialclubes_campeones',
    titulo: 'Mundial de Clubes de la FIFA', comp: 'Mundial de Clubes',
    rango: '2000–2025', script: 'mundialclubes_parse.py',
    // Nombre OFICIAL de cada certamen (encabezado de la edición, como la Copa de Campeones de América en la
    // Libertadores): 2000 y 2005 = Campeonato Mundial de Clubes.
    nombreHistorico: (ed) => ['2000', '2005'].includes(ed) ? 'Campeonato Mundial de Clubes de la FIFA' : '',
    notaEdicion: (ed) => ed === '2025'
      ? 'Primera edición con 32 equipos (8 grupos y eliminación directa), en Estados Unidos. Desde 2024 la FIFA '
      + 'disputa cada año la Copa Intercontinental y el Mundial de Clubes pasó a jugarse cada cuatro años.' : '',
  });
}
