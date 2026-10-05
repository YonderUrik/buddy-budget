// Rigenera lib/investments/world-dot-map.generated.ts: una griglia di punti (2° x 2°) delle terre emerse, con per ogni
// punto il codice dell'area geografica dell'app (n = Nord America, e = Europa, i = Italia, j = Giappone, p = Pacifico,
// m = Paesi emergenti, o = altra terra, . = mare). Le aree sono quelle di `exposure-keys.ts`: se cambiano le liste dei
// paesi, aggiornare qui le stesse liste e rilanciare.
//
// Uso (le dipendenze servono solo allo script, non all'app):
//   npm i --no-save world-atlas topojson-client d3-geo i18n-iso-countries && node scripts/generate-world-dot-map.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import { geoContains } from "d3-geo";
import countries from "i18n-iso-countries";

const OUT = "lib/investments/world-dot-map.generated.ts";
const STEP = 2;
const LAT_TOP = 80;
const LAT_BOTTOM = -56;

const AREAS = {
  n: ["US", "CA"],
  e: ["AT","BE","BG","CH","CY","CZ","DE","DK","EE","ES","FI","FR","GB","GR","HR","HU","IE","IS","LI","LT","LU","LV","MC","MT","NL","NO","PT","RO","SE","SI","SK"],
  p: ["AU", "NZ", "HK", "SG"],
  m: ["AE","AR","BR","CL","CN","CO","EG","ID","IN","KR","KW","MX","MY","PE","PH","PL","QA","SA","TH","TR","TW","ZA","VN"],
  i: ["IT"],
  j: ["JP"],
};
const areaCode = (a2) => Object.entries(AREAS).find(([, list]) => list.includes(a2))?.[0] ?? "o";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"));
const feats = feature(topo, topo.objects.countries).features.map((f) => {
  const a2 = countries.numericToAlpha2(String(f.id).padStart(3, "0"));
  return { f, c: a2 ? areaCode(a2) : "o" };
});

const rows = [];
for (let lat = LAT_TOP; lat >= LAT_BOTTOM; lat -= STEP) {
  let row = "";
  for (let lon = -180; lon < 180; lon += STEP) {
    let c = ".";
    // 4 campioni per cella, così le terre piccole (Italia) non spariscono
    search: for (const dy of [0.5, 1.5]) for (const dx of [0.5, 1.5]) {
      for (const x of feats) if (geoContains(x.f, [lon + dx, lat - dy])) { c = x.c; break search; }
    }
    row += c;
  }
  rows.push(row);
}
let min = Infinity;
let max = -1;
for (const r of rows) {
  const first = r.search(/[^.]/);
  if (first < 0) continue;
  min = Math.min(min, first);
  max = Math.max(max, r.length - 1 - [...r].reverse().findIndex((ch) => ch !== "."));
}
const trimmed = rows.map((r) => r.slice(min, max + 1));
const body = trimmed.map((r) => `  "${r}",`).join("\n");
writeFileSync(
  OUT,
  `// Generato da scripts/generate-world-dot-map.mjs (Natural Earth 1:110m, via world-atlas): non modificare a mano.\n` +
    `/** Terre emerse a punti: una stringa per riga, un carattere per punto (codici in \`WORLD_DOT_AREA_CODES\`). */\n` +
    `export const WORLD_DOT_ROWS: readonly string[] = [\n${body}\n];\n`
);
console.log(`${OUT}: ${trimmed.length} righe x ${trimmed[0].length} colonne`);
