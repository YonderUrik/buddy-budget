/**
 * Valutazione offline della categorizzazione con Jev (Fase 0 del piano «Categorizzazione con LLM»).
 *
 * Tutto gira in locale sui TUOI movimenti già categorizzati: i file prodotti stanno in `.local/` (ignorato da
 * git) e non vanno mai committati né incollati in una chat. A OpenRouter parte solo il nome pulito
 * dell'esercente (più MCC e direzione), con ZDR obbligatorio; mai importi, date, conti o identificativi.
 *
 *   pnpm eval:categorization extract --email=tu@esempio.it [--out=.local/categorization-eval]
 *   pnpm eval:categorization run [--dir=.local/categorization-eval] [--model=typesafe/jev-1.13] [--limit=200]
 *
 *   pnpm eval:categorization report [--dir=...] [--model=...]
 *
 * `report` classifica TUTTI gli esercenti, anche quelli ancora da categorizzare, e scrive `report-categorizzazione.csv`
 * (apribile in Excel) con la tua categoria accanto alla proposta di Jev, per il confronto a mano.
 * `extract` scrive anche `categories.json`: compila le descrizioni delle categorie e rilancia `run`/`report`.
 * `extract` legge il DB indicato da DATABASE_URL (in sola lettura) e scrive `golden.jsonl`: una riga per esercente
 * e direzione, con la categoria che hai scelto più spesso. `run` divide gli esercenti in due parti (70% esempi,
 * 30% prova, in modo stabile), chiede a Jev una categoria per ciascuno di prova e stampa copertura e precisione
 * per soglia di confidenza, costo e errori più frequenti. Richiede OPENROUTER_API_KEY.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { merchantKey } from "@/lib/categorization/merchant-key";
import { prepareMerchantForModel, type BlockReason } from "@/lib/categorization/privacy-filter";
import { summarizeByThreshold, topConfusions, type EvalPrediction } from "@/lib/categorization/eval-metrics";
import {
  JEV_BATCH_SIZE,
  JEV_DEFAULT_MODEL,
  classifyWithJev,
  type JevCategory,
  type JevExample,
  type JevMerchant,
} from "@/lib/llm/jev";
import type { CategoryType } from "@/lib/categories/groups";

interface GoldenRow {
  key: string;
  name: string;
  mcc: string | null;
  isIncome: boolean;
  category: string;
  categoryType: CategoryType;
  /** Movimenti dell'esercente: il peso nelle metriche. */
  count: number;
  /** Legacy input flag, cleared when loading: all names and transaction types are classified. */
  skipped: boolean;
  /** Ancora «Da categorizzare»: non ha una verità di riferimento, entra solo nel report. */
  uncategorized?: boolean;
  /** Calcolati al caricamento: nome pulito da inviare e motivo per cui non parte. */
  sendName?: string;
  blockReason?: BlockReason | null;
}

interface CategoryDescription {
  name: string;
  type: CategoryType;
  /** Da compilare a mano: cosa rientra nella categoria. Se non vuota, guida Jev. */
  description: string;
}

const EXAMPLES_PER_CATEGORY = 2;
const MAX_EXAMPLES = 40;
const TEST_SHARE = 0.3;
/** Operazioni che non descrivono un esercente: restano fuori dalla prova e non partono mai. */

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

/** Assegnazione stabile a prova o esempi, indipendente dall'ordine delle righe. */
function isTestRow(key: string): boolean {
  const byte = createHash("sha256").update(key).digest()[0];
  return byte / 255 < TEST_SHARE;
}

async function extract() {
  // Import dinamico: `run` non ha bisogno del DB e non deve richiedere DATABASE_URL.
  const { db, client } = await import("@/lib/db/client");
  const email = arg("email");
  if (!email) throw new Error("Serve --email=<utente>");
  const outDir = arg("out") ?? ".local/categorization-eval";

  const [user] = await db.select({ id: authUser.id }).from(authUser).where(eq(authUser.email, email));
  if (!user) throw new Error("Utente non trovato");

  const rows = await db
    .select({
      description: transactions.description,
      amount: transactions.amount,
      mcc: transactions.merchantCategoryCode,
      date: transactions.date,
      category: categories.name,
      categoryType: categories.type,
      isFallback: categories.isFallback,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(eq(transactions.userId, user.id));
  const userCategories = await db
    .select({ name: categories.name, type: categories.type })
    .from(categories)
    .where(and(eq(categories.userId, user.id), eq(categories.isFallback, false)));

  const groups = new Map<
    string,
    { name: string; lastDate: string; mcc: string | null; isIncome: boolean; votes: Map<string, { n: number; type: CategoryType }> }
  >();
  const fallbackGroups = new Map<string, { name: string; lastDate: string; mcc: string | null; isIncome: boolean; n: number }>();
  for (const row of rows) {
    const isIncome = Number(row.amount) > 0;
    if (row.isFallback) {
      const fallbackKey = `${merchantKey(row.description)}::${isIncome ? "in" : "out"}`;
      const entry = fallbackGroups.get(fallbackKey) ?? { name: row.description, lastDate: "", mcc: row.mcc, isIncome, n: 0 };
      entry.n += 1;
      if (row.date > entry.lastDate) {
        entry.lastDate = row.date;
        entry.name = row.description;
      }
      entry.mcc ??= row.mcc;
      fallbackGroups.set(fallbackKey, entry);
      continue;
    }
    const key = `${merchantKey(row.description)}::${isIncome ? "in" : "out"}`;
    const group = groups.get(key) ?? { name: row.description, lastDate: "", mcc: row.mcc, isIncome, votes: new Map() };
    if (row.date > group.lastDate) {
      group.lastDate = row.date;
      group.name = row.description;
    }
    group.mcc ??= row.mcc;
    const vote = group.votes.get(row.category) ?? { n: 0, type: row.categoryType };
    vote.n += 1;
    group.votes.set(row.category, vote);
    groups.set(key, group);
  }

  const golden: GoldenRow[] = [...groups].map(([key, group]) => {
    const [category, vote] = [...group.votes].sort((a, b) => b[1].n - a[1].n)[0];
    const count = [...group.votes.values()].reduce((sum, v) => sum + v.n, 0);
    return {
      key,
      name: group.name,
      mcc: group.mcc,
      isIncome: group.isIncome,
      category,
      categoryType: vote.type,
      count,
      skipped: false,
    };
  });

  const knownKeys = new Set(golden.map((row) => row.key));
  for (const [key, entry] of fallbackGroups) {
    if (knownKeys.has(key)) continue;
    golden.push({
      key,
      name: entry.name,
      mcc: entry.mcc,
      isIncome: entry.isIncome,
      category: "",
      categoryType: "voluta",
      count: entry.n,
      skipped: false,
      uncategorized: true,
    });
  }

  mkdirSync(outDir, { recursive: true });
  // Descrizioni delle categorie: se il file esiste si conservano quelle già scritte.
  const descriptionsPath = join(outDir, "categories.json");
  const previous: CategoryDescription[] = existsSync(descriptionsPath)
    ? (JSON.parse(readFileSync(descriptionsPath, "utf8")) as CategoryDescription[])
    : [];
  const descriptionByName = new Map(previous.map((c) => [c.name, c.description]));
  const descriptions: CategoryDescription[] = userCategories.map((c) => ({
    name: c.name,
    type: c.type,
    description: descriptionByName.get(c.name) ?? "",
  }));
  writeFileSync(descriptionsPath, JSON.stringify(descriptions, null, 2) + "\n");
  writeFileSync(join(outDir, "golden.jsonl"), golden.map((row) => JSON.stringify(row)).join("\n") + "\n");
  const skipped = golden.filter((row) => row.skipped).length;
  const todo = golden.filter((row) => row.uncategorized).length;
  console.log(`${rows.length} movimenti, ${golden.length} esercenti (${todo} da categorizzare, ${skipped} esclusi come non-esercenti).`);
  console.log(`Scritto ${descriptionsPath}: compila le descrizioni delle categorie per aiutare Jev.`);
  console.log(`Scritto ${join(outDir, "golden.jsonl")} — resta sul tuo computer.`);
  await client.end();
}

/** Righe di riferimento e categorie dell'utente (con le descrizioni scritte a mano, se ci sono). */
function loadGolden(dir: string): { golden: GoldenRow[]; categoryOptions: JevCategory[] } {
  const golden = readFileSync(join(dir, "golden.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoldenRow);
  for (const row of golden) {
    const prepared = prepareMerchantForModel(row.name);
    row.sendName = prepared.name;
    row.blockReason = null;
    row.skipped = false;
  }
  const path = join(dir, "categories.json");
  const described: CategoryDescription[] = existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as CategoryDescription[]) : [];
  const categoryOptions = new Map<string, JevCategory>(described.map((c) => [c.name, { name: c.name, type: c.type, description: c.description }]));
  for (const row of golden) {
    if (row.category && !categoryOptions.has(row.category)) categoryOptions.set(row.category, { name: row.category, type: row.categoryType });
  }
  return { golden, categoryOptions: [...categoryOptions.values()] };
}

function pickExamples(pool: GoldenRow[]): (JevExample & { key: string })[] {
  const perCategory = new Map<string, number>();
  const examples: (JevExample & { key: string })[] = [];
  for (const row of [...pool].sort((a, b) => b.count - a.count)) {
    const used = perCategory.get(row.category) ?? 0;
    if (used >= EXAMPLES_PER_CATEGORY || examples.length >= MAX_EXAMPLES) continue;
    perCategory.set(row.category, used + 1);
    examples.push({ key: row.key, name: row.sendName ?? row.name, category: row.category });
  }
  return examples;
}

async function run() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Serve OPENROUTER_API_KEY");
  const dir = arg("dir") ?? ".local/categorization-eval";
  const model = arg("model") ?? JEV_DEFAULT_MODEL;
  const limit = Number(arg("limit") ?? "0");

  const { golden, categoryOptions } = loadGolden(dir);

  const usable = golden.filter((row) => !row.skipped && !row.uncategorized);
  const pool = usable.filter((row) => !isTestRow(row.key));
  let test = usable.filter((row) => isTestRow(row.key));
  if (limit > 0) test = test.slice(0, limit);

  const examples = pickExamples(pool).map(({ name, category }) => ({ name, category }));

  console.log(`Prova: ${test.length} esercenti, esempi: ${examples.length}, categorie: ${categoryOptions.length}, modello: ${model}`);

  const predictions: EvalPrediction[] = [];
  let costUsd = 0;
  let costKnown = true;
  let inputTokens = 0;
  const started = Date.now();

  for (let i = 0; i < test.length; i += JEV_BATCH_SIZE) {
    const batch = test.slice(i, i + JEV_BATCH_SIZE);
    const merchants: JevMerchant[] = batch.map((row, index) => ({
      id: String(i + index),
      name: row.sendName ?? row.name,
      mcc: row.mcc,
      isIncome: row.isIncome,
    }));
    const result = await classifyWithJev({ merchants, categories: categoryOptions, examples, model }, { apiKey });
    inputTokens += result.inputTokens;
    if (result.costUsd === null) costKnown = false;
    else costUsd += result.costUsd;
    const byId = new Map(result.decisions.map((d) => [d.id, d]));
    batch.forEach((row, index) => {
      const decision = byId.get(String(i + index));
      predictions.push({
        expected: row.category,
        predicted: decision?.categoryName ?? null,
        confidence: decision?.confidence ?? 0,
        weight: row.count,
      });
    });
    console.log(`  ${Math.min(i + JEV_BATCH_SIZE, test.length)}/${test.length}`);
  }

  const seconds = (Date.now() - started) / 1000;
  console.log("\nsoglia  copertura  precisione   (pesate sui movimenti)");
  for (const row of summarizeByThreshold(predictions)) {
    console.log(
      `${row.threshold.toFixed(2).padEnd(7)} ${(row.coverage * 100).toFixed(1).padStart(8)}%  ${(row.precision * 100).toFixed(1).padStart(9)}%`
    );
  }
  console.log(`\nToken in ingresso: ${inputTokens}, costo: ${costKnown ? `${costUsd.toFixed(5)} $` : "non indicato"}, tempo: ${seconds.toFixed(0)} s`);
  console.log(`Esercenti senza proposta: ${predictions.filter((p) => p.predicted === null).length}`);
  console.log("\nErrori più frequenti (verità -> proposta):");
  for (const [pair, weight] of topConfusions(predictions)) console.log(`  ${weight}  ${pair}`);

  writeFileSync(join(dir, `risultati-${Date.now()}.json`), JSON.stringify({ model, predictions }, null, 1));
}

/** Campo CSV con separatore «;» (Excel in italiano): virgolette raddoppiate, mai a capo dentro il campo. */
function csvField(value: string | number): string {
  return `"${String(value).replace(/"/g, '""').replace(/\s+/g, " ")}"`;
}

/**
 * Classifica TUTTI gli esercenti (anche quelli ancora da categorizzare) e scrive un CSV da confrontare a mano:
 * categoria attuale accanto alla proposta di Jev, con confidenza e seconda scelta. Gli esempi dati a Jev
 * sono marcati, perché per loro l'accordo non misura nulla.
 */
async function report() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Serve OPENROUTER_API_KEY");
  const dir = arg("dir") ?? ".local/categorization-eval";
  const model = arg("model") ?? JEV_DEFAULT_MODEL;
  const { golden, categoryOptions } = loadGolden(dir);

  const sendable = golden.filter((row) => !row.skipped);
  const examplePicks = pickExamples(sendable.filter((row) => !row.uncategorized && !isTestRow(row.key)));
  const exampleKeys = new Set(examplePicks.map((e) => e.key));
  const examples = examplePicks.map(({ name, category }) => ({ name, category }));
  console.log("Tutti i nomi e tipi di movimento sono inclusi nella valutazione.");
  console.log(`Report: ${sendable.length} esercenti da classificare (${golden.length - sendable.length} esclusi), esempi: ${examples.length}, modello: ${model}`);

  const decisions = new Map<string, { category: string; confidence: number; second: string; secondConfidence: number }>();
  let costUsd = 0;
  let costKnown = true;
  for (let i = 0; i < sendable.length; i += JEV_BATCH_SIZE) {
    const batch = sendable.slice(i, i + JEV_BATCH_SIZE);
    const merchants: JevMerchant[] = batch.map((row, index) => ({ id: String(i + index), name: row.sendName ?? row.name, mcc: row.mcc, isIncome: row.isIncome }));
    const result = await classifyWithJev({ merchants, categories: categoryOptions, examples, model }, { apiKey });
    if (result.costUsd === null) costKnown = false;
    else costUsd += result.costUsd;
    for (const decision of result.decisions) {
      const [secondName, secondProbability] =
        Object.entries(decision.probabilities)
          .filter(([name]) => name !== decision.categoryName)
          .sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
      decisions.set(decision.id, { category: decision.categoryName, confidence: decision.confidence, second: secondName, secondConfidence: secondProbability });
    }
    console.log(`  ${Math.min(i + JEV_BATCH_SIZE, sendable.length)}/${sendable.length}`);
  }

  const idByKey = new Map(sendable.map((row, index) => [row.key, String(index)]));
  const outcome = (row: GoldenRow, proposed: string | undefined): string => {
    if (row.skipped) return "non inviato";
    if (!proposed) return "nessuna proposta";
    if (row.uncategorized) return "da categorizzare";
    if (exampleKeys.has(row.key)) return "esempio";
    return proposed === row.category ? "uguale" : "diverso";
  };
  const order = { diverso: 0, "da categorizzare": 1, "nessuna proposta": 2, "non inviato": 3, uguale: 4, esempio: 5 } as Record<string, number>;
  const lines = golden
    .map((row) => {
      const d = decisions.get(idByKey.get(row.key) ?? "");
      return { row, d, result: outcome(row, d?.category) };
    })
    .sort((a, b) => order[a.result] - order[b.result] || b.row.count - a.row.count)
    .map(({ row, d, result }) =>
      [
        row.name,
        row.isIncome ? "entrata" : "uscita",
        row.count,
        row.category || "(da categorizzare)",
        d?.category ?? "",
        d ? d.confidence.toFixed(2) : "",
        d?.second ?? "",
        d ? d.secondConfidence.toFixed(2) : "",
        result === "non inviato" ? `non inviato (${row.blockReason ?? "operazione"})` : result,
        "",
      ]
        .map(csvField)
        .join(";")
    );
  const header = ["esercente", "direzione", "movimenti", "categoria_attuale", "proposta_jev", "confidenza", "seconda_scelta", "confidenza_2a", "esito", "giudizio_tuo"];
  const path = join(dir, "report-categorizzazione.csv");
  writeFileSync(path, "\uFEFF" + [header.map(csvField).join(";"), ...lines].join("\r\n") + "\r\n");

  const compared = golden.filter((row) => !row.skipped && !row.uncategorized && !exampleKeys.has(row.key));
  const same = compared.filter((row) => decisions.get(idByKey.get(row.key) ?? "")?.category === row.category);
  console.log(`\nScritto ${path} — resta sul tuo computer.`);
  console.log(`Accordo sugli esercenti già categorizzati (esempi esclusi): ${same.length}/${compared.length}`);
  console.log(`Costo: ${costKnown ? `${costUsd.toFixed(5)} $` : "non indicato"}`);
}

async function main() {
  const command = process.argv[2];
  if (command === "extract") await extract();
  else if (command === "run") await run();
  else if (command === "report") await report();
  else throw new Error("Comando: extract | run | report");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
