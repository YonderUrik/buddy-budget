// Rigenera le icone degli strumenti: copia gli SVG delle crypto in public/instrument-icons/crypto/ e scrive
// lib/investments/instrument-icons.generated.ts (nome crypto → file, marchi di azioni → percorso SVG e colore).
// Sorgenti, entrambe CC0 (i marchi restano dei rispettivi titolari, usati solo per identificare lo strumento):
//   - cryptocurrency-icons (spothq/cryptocurrency-icons)
//   - simple-icons (simpleicons.org)
// Le liste dei marchi azionari stanno in BRANDS qui sotto: per aggiungerne uno serve lo slug di simple-icons e le
// parole con cui il nome dello strumento inizia.
//
// Uso (le dipendenze servono solo allo script, non all'app):
//   (cd /tmp && mkdir -p icons && cd icons && npm init -y && npm i simple-icons cryptocurrency-icons)
//   ICONS_MODULES=/tmp/icons/node_modules node scripts/generate-instrument-icons.mjs
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = "lib/investments/instrument-icons.generated.ts";
const CRYPTO_DIR = "public/instrument-icons/crypto";

/** slug simple-icons → inizi del nome (minuscolo, senza punteggiatura) con cui lo si riconosce. */
const BRANDS = {
  apple: ["apple"],
  tesla: ["tesla"],
  nvidia: ["nvidia"],
  meta: ["meta platforms", "facebook"],
  netflix: ["netflix"],
  ferrari: ["ferrari"],
  intel: ["intel"],
  amd: ["advanced micro devices", "amd"],
  spotify: ["spotify"],
  paypal: ["paypal"],
  visa: ["visa"],
  mastercard: ["mastercard"],
  cocacola: ["coca cola", "cocacola"],
  nike: ["nike"],
  adidas: ["adidas"],
  bmw: ["bmw", "bayerische motoren"],
  volkswagen: ["volkswagen"],
  porsche: ["porsche"],
  airbus: ["airbus"],
  shell: ["shell"],
  samsung: ["samsung"],
  sony: ["sony"],
  toyota: ["toyota"],
  uber: ["uber"],
  airbnb: ["airbnb"],
  cisco: ["cisco"],
  qualcomm: ["qualcomm"],
  sap: ["sap"],
  siemens: ["siemens"],
  fiat: ["fiat"],
  vodafone: ["vodafone"],
  shopify: ["shopify"],
  ebay: ["ebay"],
  starbucks: ["starbucks"],
  mcdonalds: ["mcdonalds", "mcdonald s"],
  americanexpress: ["american express"],
  goldmansachs: ["goldman sachs"],
  hsbc: ["hsbc"],
  deutschebank: ["deutsche bank"],
};

// Le due librerie si installano fuori dal progetto (vedi "Uso") e si indicano con ICONS_MODULES.
const modules = process.env.ICONS_MODULES ?? `${process.cwd()}/node_modules`;
const simpleIconsDir = `${modules}/simple-icons/`;
const cryptoDir = `${modules}/cryptocurrency-icons/`;

const normalize = (s) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

// Crypto: nome normalizzato → simbolo minuscolo (file in public/instrument-icons/crypto/<simbolo>.svg)
mkdirSync(CRYPTO_DIR, { recursive: true });
const manifest = JSON.parse(readFileSync(`${cryptoDir}manifest.json`, "utf8"));
const cryptoNames = {};
for (const { symbol, name } of manifest) {
  const file = symbol.toLowerCase();
  const src = `${cryptoDir}svg/color/${file}.svg`;
  if (!/^[a-z0-9]+$/.test(file) || !existsSync(src)) continue;
  copyFileSync(src, `${CRYPTO_DIR}/${file}.svg`);
  cryptoNames[normalize(name)] ??= file;
  cryptoNames[normalize(symbol)] ??= file;
}

// Marchi azionari: percorso dell'SVG e colore ufficiale dal catalogo simple-icons
const catalog = JSON.parse(readFileSync(`${simpleIconsDir}data/simple-icons.json`, "utf8"));
const brands = [];
for (const [slug, prefixes] of Object.entries(BRANDS)) {
  const meta = catalog.find((i) => i.slug === slug);
  const svg = readFileSync(`${simpleIconsDir}icons/${slug}.svg`, "utf8");
  const path = svg.match(/<path d="([^"]+)"/)?.[1];
  if (!meta || !path) throw new Error(`simple-icons: ${slug} non trovato`);
  brands.push({ slug, title: meta.title, hex: meta.hex, prefixes, path });
}

const body = `// Generato da scripts/generate-instrument-icons.mjs: non modificare a mano.
// Crypto: icone CC0 di spothq/cryptocurrency-icons. Marchi: simple-icons (CC0), i marchi restano dei titolari.

/** Nome o simbolo normalizzato di una crypto → file in public/instrument-icons/crypto/ (senza estensione). */
export const CRYPTO_ICON_FILES: Record<string, string> = ${JSON.stringify(cryptoNames)};

export interface BrandIcon {
  slug: string;
  title: string;
  /** Colore ufficiale esadecimale, senza #. */
  hex: string;
  /** Inizi del nome normalizzato con cui si riconosce l'azienda. */
  prefixes: string[];
  /** Percorso SVG su viewBox 24×24. */
  path: string;
}

export const BRAND_ICONS: BrandIcon[] = ${JSON.stringify(brands, null, 2)};
`;
writeFileSync(OUT, body);
console.log(`crypto: ${Object.keys(cryptoNames).length} chiavi, marchi: ${brands.length}`);
