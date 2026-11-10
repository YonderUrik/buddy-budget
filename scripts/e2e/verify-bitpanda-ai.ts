/** Live AI verification using only synthetic data; no database writes or email sends. Runs the real recovery ladder. */
import { readFileSync } from "node:fs";
import { generateParser } from "@/lib/personal-import/generate";
import { readRawFile } from "@/lib/personal-import/contract";
import { runLadder } from "@/lib/personal-import/analysis";
import { classifyFile } from "@/lib/personal-import/hints";
import { executeParser } from "@/lib/personal-import/sandbox";

async function main() {
  const file = process.argv[2] ?? "lib/personal-import/fixtures/bitpanda-inclusive-fees.csv";
  const table = readRawFile(readFileSync(file, "utf8"));
  const hints = { defaultCurrency: "EUR", today: new Date().toISOString().slice(0, 10), dateOrderHint: "dmy" as const, fileKind: classifyFile(table.rawCsv ?? "") };
  const generated = await runLadder({
    table, execute: executeParser, model: process.env.OPENROUTER_MODEL ?? "unknown",
    generate: request => generateParser(table, { sourceName: process.argv[3] ?? "Bitpanda", hints, request }),
    onAttempt: async record => { console.log(`Step ${record.step} rejected: ${record.reason}${record.detail ? ` (${record.detail})` : ""}`); },
  });
  const balance = generated.outcomes.reduce((sum, o) => sum + (o.kind === "cash" ? o.amount : o.kind === "investment" ? -o.quantity * o.price - o.fees : 0), 0);
  if (!process.argv[2] && Math.abs(balance - 100) > 0.001) throw new Error("Incorrect balance");
  console.log(JSON.stringify({ model: generated.model, step: generated.step, rows: generated.outcomes.length, balance, source: "synthetic fixture", generation: "real AI, no manual parser edits" }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
