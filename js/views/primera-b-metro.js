// Vista: Primera B Metropolitana (tercer nivel AFA, 1986/87–2026). Ver tercera.js.

import {render as renderTabla} from './tabla-historica.js';
import {PRIMERA_B_METRO} from './tercera.js';

export async function render(container, params = {}) {
  await renderTabla(container, params, PRIMERA_B_METRO);
}
