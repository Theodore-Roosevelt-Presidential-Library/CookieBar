# Territory outlines

One small outline per state or country, shown in the "Why this?" tab. Each file is `{ key, viewBox, d }`: an SVG path fitted to a 64-pixel box.

- US states: [us-atlas](https://github.com/topojson/us-atlas) (derived from the U.S. Census Bureau's cartographic boundary files, public domain)
- Countries: [world-atlas](https://github.com/topojson/world-atlas) (derived from Natural Earth, public domain)

Overseas territories and tiny islands are dropped so the main shape reads clearly at small sizes. Quebec has no outline yet (province shapes aren't in these sources), so its tab shows text only.

Rebuild:

```bash
cd scripts && npm i d3-geo@3 topojson-client@3 topojson-simplify@3 us-atlas@3 world-atlas@2
node build-shapes.mjs ../shapes
```
