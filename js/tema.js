// Selector de tema (Automático / Claro / Oscuro) del encabezado. La preferencia se guarda en localStorage
// ('tema' = 'light' | 'dark'; sin valor = automático). El tema efectivo va en <html data-theme="light|dark">,
// que es lo que lee el CSS; el script del <head> de index.html lo aplica antes de pintar y acá se actualiza al
// elegir otra opción o, en automático, cuando cambia la preferencia del sistema.

const CLAVE = 'tema';
const mqOscuro = matchMedia('(prefers-color-scheme: dark)');

function leer() {
  try {
    const t = localStorage.getItem(CLAVE);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto';
  }
}

function guardar(pref) {
  try {
    if (pref === 'auto') localStorage.removeItem(CLAVE);
    else localStorage.setItem(CLAVE, pref);
  } catch {
    // sin storage: el tema elegido dura hasta recargar
  }
}

const botones = [...document.querySelectorAll('.tema-sel [data-tema]')];
let actual = leer();

function aplicar(pref) {
  actual = pref;
  const oscuro = pref === 'dark' || (pref === 'auto' && mqOscuro.matches);
  document.documentElement.setAttribute('data-theme', oscuro ? 'dark' : 'light');
  for (const b of botones) b.setAttribute('aria-pressed', String(b.dataset.tema === pref));
}

for (const b of botones) {
  b.addEventListener('click', () => {
    guardar(b.dataset.tema);
    aplicar(b.dataset.tema);
  });
}
mqOscuro.addEventListener('change', () => {
  if (actual === 'auto') aplicar('auto');
});

aplicar(actual);
