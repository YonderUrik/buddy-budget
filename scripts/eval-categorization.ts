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
 * `extract` legge il DB indicato da DATABASE_URL (in sola lettura) e scrive `golden.jsonl`: una riga per esercente
 * e direzione, con la categoria che hai scelto più spesso. `run` divide gli esercenti in due parti (70% esempi,
 * 30% prova, in modo stabile), chiede a Jev una categoria per ciascuno di prova e stampa copertura e precisione
 * per soglia di confidenza, costo e errori più frequenti. Richiede OPENROUTER_API_KEY.
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq } from "drizzle-orm";
import { authUser } from "@/lib/db/schema/auth";
import { categories } from "@/lib/db/schema/categories";
import { transactions } from "@/lib/db/schema/transactions";
import { merchantKey } from "@/lib/categorization/merchant-key";
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
  /** Escluso dalla prova perché sembra un trasferimento o un pagamento a una persona. */
  skipped: boolean;
}

const EXAMPLES_PER_CATEGORY = 2;
const MAX_EXAMPLES = 40;
const TEST_SHARE = 0.3;
/** Operazioni che non descrivono un esercente: restano fuori dalla prova e non partono mai. */
const NON_MERCHANT = /\b(bonifico|giroconto|giro conto|trasferimento|ricarica|prelievo|prelevamento|bollo|f24|stipendio)\b/i;

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
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .where(and(eq(transactions.userId, user.id), eq(categories.isFallback, false)));

  const groups = new Map<
    string,
    { name: string; lastDate: string; mcc: string | null; isIncome: boolean; votes: Map<string, { n: number; type: CategoryType }> }
  >();
  for (const row of rows) {
    const isIncome = Number(row.amount) > 0;
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
      skipped: NON_MERCHANT.test(group.name),
    };
  });

  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, "golden.jsonl"), golden.map((row) => JSON.stringify(row)).join("\n") + "\n");
  const skipped = golden.filter((row) => row.skipped).length;
  console.log(`${rows.length} movimenti categorizzati, ${golden.length} esercenti (${skipped} esclusi come non-esercenti).`);
  console.log(`Scritto ${join(outDir, "golden.jsonl")} — resta sul tuo computer.`);
  await client.end();
}

function pickExamples(pool: GoldenRow[]): JevExample[] {
  const perCategory = new Map<string, number>();
  const examples: JevExample[] = [];
  for (const row of [...pool].sort((a, b) => b.count - a.count)) {
    const used = perCategory.get(row.category) ?? 0;
    if (used >= EXAMPLES_PER_CATEGORY || examples.length >= MAX_EXAMPLES) continue;
    perCategory.set(row.category, used + 1);
    examples.push({ name: row.name, category: row.category });
  }
  return examples;
}

async function run() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Serve OPENROUTER_API_KEY");
  const dir = arg("dir") ?? ".local/categorization-eval";
  const model = arg("model") ?? JEV_DEFAULT_MODEL;
  const limit = Number(arg("limit") ?? "0");

  const golden = readFileSync(join(dir, "golden.jsonl"), "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GoldenRow);

  const usable = golden.filter((row) => !row.skipped);
  const pool = usable.filter((row) => !isTestRow(row.key));
  let test = usable.filter((row) => isTestRow(row.key));
  if (limit > 0) test = test.slice(0, limit);

  const categoryList = new Map<string, JevCategory>();
  for (const row of golden) categoryList.set(row.category, { name: row.category, type: row.categoryType });
  const categoryOptions = [...categoryList.values()];
  const examples = pickExamples(pool);

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
      name: row.name,
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

async function main() {
  const command = process.argv[2];
  if (command === "extract") await extract();
  else if (command === "run") await run();
  else throw new Error("Comando: extract | run");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
