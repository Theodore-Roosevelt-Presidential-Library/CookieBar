import fs from 'node:fs';
import { geoPath, geoMercator, geoConicEqualArea, geoArea, geoCentroid, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import { presimplify, simplify } from 'topojson-simplify';
import { topology } from 'topojson-server';

const OUT = process.argv[2];
fs.mkdirSync(OUT, { recursive: true });
const SIZE = 64;

const ISO = { AT:40,BE:56,BG:100,HR:191,CY:196,CZ:203,DK:208,EE:233,FI:246,FR:250,DE:276,GR:300,HU:348,IE:372,IT:380,LV:428,LT:440,LU:442,MT:470,NL:528,PL:616,PT:620,RO:642,SK:703,SI:705,ES:724,SE:752,IS:352,LI:438,NO:578,GB:826,CH:756,BR:76 };
const NAMES = { NO: 'Norway', FR: 'France' };
const US = { AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming' };

// Keep the main landmass: drop far-flung overseas parts (French Guiana, Azores, Svalbard...).
function mainland(f, maxDeg) {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const polys = f.geometry.coordinates.map(c => ({ c, g: { type: 'Polygon', coordinates: c } }));
  polys.forEach(p => { p.a = geoArea(p.g); p.ct = geoCentroid(p.g); });
  const big = polys.reduce((m, p) => p.a > m.a ? p : m);
  const keep = polys.filter(p => geoDistance(p.ct, big.ct) * 180 / Math.PI <= maxDeg && p.a >= big.a * 0.004);
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: keep.map(p => p.c) } };
}

function write(key, f, proj) {
  proj.fitSize([SIZE, SIZE], f);
  const path = geoPath(proj).digits(1);
  const d = path(f);
  const [[x0, y0], [x1, y1]] = path.bounds(f);
  const out = { key, viewBox: [Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0), Math.ceil(y1 - y0)].join(' '), d };
  fs.writeFileSync(`${OUT}/${key}.json`, JSON.stringify(out));
  return d.length;
}

function prep(topoFile, obj, weight) {
  let t = JSON.parse(fs.readFileSync(topoFile));
  t = simplify(presimplify(t), weight);
  return feature(t, t.objects[obj]).features;
}

const report = [];
// US states (Census-derived us-atlas, 10m)
const coarse = prep('node_modules/us-atlas/states-10m.json', 'states', 3e-3);
for (let f of prep('node_modules/us-atlas/states-10m.json', 'states', 1e-4)) {
  if (f.properties.name === 'Alaska') f = coarse.find(c => c.properties.name === 'Alaska');
  const code = Object.keys(US).find(k => US[k] === f.properties.name);
  if (!code) continue;
  const g = mainland(f, code === 'AK' ? 25 : code === 'HI' ? 10 : 8);
  const proj = code === 'AK' ? geoConicEqualArea().rotate([150, 0]).parallels([55, 65]) : geoMercator();
  report.push(`US-${code}:${write('US-' + code, g, proj)}`);
}
// Countries (Natural Earth via world-atlas, 50m)
const countries = prep('node_modules/world-atlas/countries-50m.json', 'countries', 2e-3);
for (const [code, num] of Object.entries(ISO)) {
  let f = countries.find(c => Number(c.id) === num) || countries.find(c => c.properties.name === NAMES[code]);
  if (!f) { report.push(code + ':MISSING'); continue; }
  f = mainland(f, code === 'NO' ? 12 : code === 'GR' ? 8 : 15);
  report.push(`${code}:${write(code, f, geoMercator())}`);
}
// Canadian provinces (Natural Earth admin-1, 50m, public domain)
const NE_ADMIN1 = process.argv[3];
if (NE_ADMIN1 && fs.existsSync(NE_ADMIN1)) {
  const raw = JSON.parse(fs.readFileSync(NE_ADMIN1));
  raw.features = raw.features.filter(f => (f.properties.iso_3166_2 || '').startsWith('CA-'));
  let topo = topology({ p: raw }, 1e5);
  topo = simplify(presimplify(topo), 2e-3);
  const gj = feature(topo, topo.objects.p);
  for (const f of gj.features) {
    const code = f.properties.iso_3166_2;
    if (!code || !code.startsWith('CA-')) continue;
    const g = mainland(f, 12);
    report.push(`${code}:${write(code, g, geoConicEqualArea().rotate([96, 0]).parallels([50, 70]))}`);
  }
}
console.log(report.join(' '));
