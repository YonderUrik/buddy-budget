// Copia il catalogo condiviso (../lib/features, solo dati) in .shared/features, ignorato da git.
// Serve perché Next/Turbopack non risolve file fuori dalla cartella del progetto senza allargare la radice
// (che farebbe caricare anche proxy.ts e instrumentation.ts dell'app).
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, ".shared", "features");
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(join(root, "..", "lib", "features"), target, { recursive: true, filter: (src) => !src.endsWith(".test.ts") });
