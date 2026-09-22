// Vista: Copa Libertadores de América (1960–2025). Usa el módulo compartido copa_internacional.
// El Campeonato Sudamericano de Campeones 1948 NO se cuenta acá (competición aparte). Datos:
// data/libertadores.json (parseado de RSSSF sacups/, scripts/libertadores_parse.py).

import {renderCopa} from '../copa_internacional.js';

export async function render(container, params = {}) {
  await renderCopa(container, params, {
    dataKey: 'libertadores', campKey: 'libertadores_campeones',
    titulo: 'Copa Libertadores de América', comp: 'Copa Libertadores',
    rango: '1960–2025', script: 'libertadores_parse.py',
    // 1960-1964 se disputó como "Copa de Campeones de América" (se contabiliza como Libertadores). El
    // 1948 es el Campeonato Sudamericano de Campeones (precursor, edición NO oficial: no suma al palmarés).
    nombreHistorico: (ed) => (+ed >= 1960 && +ed <= 1964) ? 'Copa de Campeones de América'
      : (+ed === 1948 ? 'Campeonato Sudamericano de Campeones — edición no oficial (precursora)' : ''),
  });
}
