/**
 * Scarica da Logo.dev i loghi degli strumenti d'esempio della home (Enel, Vanguard, MEF, Bitcoin) in
 * `public/logos/market/`. Si lancia a mano quando l'elenco cambia, non in CI: il sito esportato serve solo i file
 * copiati qui, quindi il browser di chi visita non parla mai con Logo.dev.
 *
 *   LOGODEV_PUBLISHABLE_KEY=pk_... node scripts/fetch-market-logos.mjs
 *
 * L'attribuzione «Loghi forniti da Logo.dev» sta nel piè di pagina (`components/site-footer.tsx`).
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "logos", "market");
/** Lato richiesto (px): i riquadri della home sono 24-32 px, 128 reggono gli schermi ad alta densità. */
const SIZE_PX = 128;
/** Un logo più grande di così non è un logo (stesso limite dell'app). */
const MAX_BYTES = 100 * 1024;
const REQUEST_TIMEOUT_MS = 10_000;

/** File di destinazione e percorso su Logo.dev: un dominio, oppure `crypto/<sigla>` per le monete. */
const LOGOS = [
  { file: "enel", path: "enel.com" },
  { file: "vanguard", path: "vanguard.com" },
  { file: "mef", path: "mef.gov.it" },
  { file: "bitcoin", path: "crypto/btc" },
];

const token = process.env.LOGODEV_PUBLISHABLE_KEY;
if (!token) {
  console.error("Manca LOGODEV_PUBLISHABLE_KEY (chiave pubblica pk_…, la stessa dell'app).");
  process.exit(1);
}

await mkdir(OUT_DIR, { recursive: true });
for (const { file, path } of LOGOS) {
  const params = new URLSearchParams({ token, size: String(SIZE_PX), format: "webp", fallback: "404" });
  const response = await fetch(`https://img.logo.dev/${path}?${params}`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const type = response.headers.get("content-type") ?? "";
  if (!response.ok || !type.startsWith("image/")) {
    console.error(`${path}: risposta ${response.status} (${type}), file saltato`);
    process.exitCode = 1;
    continue;
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    console.error(`${path}: ${bytes.length} byte, file saltato`);
    process.exitCode = 1;
    continue;
  }
  await writeFile(join(OUT_DIR, `${file}.webp`), bytes);
  console.log(`${path} → public/logos/market/${file}.webp (${bytes.length} byte)`);
}
