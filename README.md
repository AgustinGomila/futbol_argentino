# Estadísticas del Fútbol Argentino

Web de consulta histórica de estadísticas del fútbol argentino de primera división
(**1891–2025**), con cobertura de las principales copas nacionales e internacionales.

**Todo se calcula partido a partido** (1891–2025): las tablas de posiciones, los campeones y los
históricos se **derivan de los partidos individuales**, no se copian.

## Qué se puede consultar

- **Tabla histórica** — posiciones y campeones por torneo y por temporada, con fases
  (grupos, eliminatorias, liguillas) y fechas/jornadas expandibles.
- **Mano a mano** — historial de enfrentamientos entre dos clubes.
- **Copas** e **Copas históricas** — Copa Argentina y demás copas nacionales, con
  tabla all-time por club.
- **Copas internacionales** — Copa Libertadores, Copa Sudamericana, Recopa Sudamericana,
  Supercopa Sudamericana, Copa Máster de Supercopa, Copa Conmebol, Copa Conmebol Masters,
  Copa Mercosur, Copa de Oro, Copa Interamericana, Recopa Sudamericana de Clubes,
  Suruga Bank Championship y Copa Intercontinental; más las rioplatenses históricas
  (Copa Aldao, Copa Escobar-Gerona, Copa de Honor Cousenier y Cup Tie Competition).
- **Campeones** — palmarés por club (ligas + copas), con desglose por título.
- **Efemérides** — qué pasó un día del año (clubes fundados, títulos ganados).
- **Ficha de club** — datos del club y enfrentamientos filtrables por rival, era y competición.

## Ejecutar localmente

Es un sitio **estático** (módulos ES, sin build ni framework). Alcanza con servir la carpeta:

```bash
python -m http.server 8000
# abrir http://localhost:8000
```

## Datos

Fuente base: [RSSSF](https://www.rsssf.org/) (Rec.Sport.Soccer Statistics Foundation) y
registros de la AFA. Los datos se sirven precomputados como JSON en `data/`.

## Licencia

Los datos derivan de fuentes públicas (RSSSF). Se distribuye para consulta y uso
personal; al reutilizar los datos, dar el crédito correspondiente a las fuentes originales.
