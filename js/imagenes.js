// Rutas de las imágenes que sirve la web (generadas por scripts/imagenes_build.py desde los originales de
// images/): WebP en DOS tamaños según cómo se muestran.
//   'c' (chico, img/72/)   -> escudos de tablas/desplegables/gráficos/chips y miniaturas de trofeos (16-40 px)
//   'g' (grande, img/200/) -> escudo de la ficha (88 px), fusiones (44 px) y el "vs" del Mano a mano (64 px)
// `archivo` es el nombre relativo a images/ tal como viene en los JSON ('river-plate.png', 'cups/x.png',
// 'provinces/x.png'). Las banderas son SVG (sin tamaños): img/flags/.

const TAM = {c: 72, g: 200};

export const imgSrc = (archivo, tam = 'c') =>
  archivo ? `img/${TAM[tam]}/${String(archivo).replace(/\.(png|jpe?g|gif|webp)$/i, '')}.webp` : '';

export const banderaSrc = (archivo) => (archivo ? `img/flags/${archivo}.svg` : '');
