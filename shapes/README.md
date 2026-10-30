# Territory outlines

One small outline per state or country, shown in the "Why this?" tab. Each file is `{ key, viewBox, d }`: an SVG path fitted to a 64-pixel box.

- US states: [us-atlas](https://github.com/topojson/us-atlas) (derived from the U.S. Census Bureau's cartographic boundary files, public domain)
- Countries: [world-atlas](https://github.com/topojson/world-atlas) (derived from Natural Earth, public domain)
- Canadian provinces: [Natural Earth](https://www.naturalearthdata.com/) admin-1 states and provinces, 1:50m (public domain)

Overseas territories and tiny islands are dropped so the main shape reads clearly at small sizes.

Rebuild:

```bash
cd scripts && npm i d3-geo@3 topojson-client@3 topojson-simplify@3 us-atlas@3 world-atlas@2
npm i topojson-server@3
curl -LO https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_1_states_provinces.geojson
node build-shapes.mjs ../shapes ne_50m_admin_1_states_provinces.geojson
```
