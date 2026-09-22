// Vista: Torneo Federal A (tercer nivel del Consejo Federal; Torneo Argentino A 1995/96–2013/14). Ver tercera.js.

import {render as renderTabla} from './tabla-historica.js';
import {FEDERAL_A} from './tercera.js';

export async function render(container, params = {}) {
  await renderTabla(container, params, FEDERAL_A);
}
