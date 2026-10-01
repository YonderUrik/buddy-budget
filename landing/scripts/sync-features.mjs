// Copia il catalogo condiviso dell'app (../lib/features/catalog.ts) in content/catalog.generated.ts.
// `node scripts/sync-features.mjs` scrive la copia; con `--check` fallisce se è fuori allineo (usato in CI).
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(root, "..", "lib", "features", "catalog.ts");
const target = join(root, "content", "catalog.generated.ts");
const header = "// GENERATO da scripts/sync-features.mjs a partire da lib/features/catalog.ts: non modificare a mano.\n";

const expected = header + readFileSync(source, "utf8");
if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(target, "utf8");
  } catch {}
  if (current !== expected) {
    console.error("content/catalog.generated.ts non è allineato a lib/features/catalog.ts: lancia `pnpm sync:features` e committa.");
    process.exit(1);
  }
} else {
  writeFileSync(target, expected);
  console.log("catalogo sincronizzato");
}
