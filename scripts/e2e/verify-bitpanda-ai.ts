/** Live AI verification using only synthetic data; no database writes or email sends. */
import { readFileSync } from "node:fs";
import { generateParser } from "@/lib/personal-import/generate";
import { readRawFile } from "@/lib/personal-import/contract";
import { runCheckedParser } from "@/lib/personal-import/analysis";
import { executeParser } from "@/lib/personal-import/sandbox";

async function main() {
  const table = readRawFile(readFileSync("lib/personal-import/fixtures/bitpanda-inclusive-fees.csv", "utf8"));
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const generated = await generateParser(table, "Bitpanda");
      const outcomes = await runCheckedParser(generated.parser, table, executeParser);
      if (outcomes.some(o => o.kind === "error")) throw new Error("AI returned review errors");
      const balance = outcomes.reduce((sum, o) => sum + (o.kind === "cash" ? o.amount : o.kind === "investment" ? -o.quantity * o.price - o.fees : 0), 0);
      if (Math.abs(balance - 100) > 0.001) throw new Error("Incorrect balance");
      console.log(JSON.stringify({ model: generated.model, balance, source: "synthetic fixture", generation: "real AI, no manual parser edits", reconciliation: "passed", attempt }, null, 2));
      return;
    } catch {
      console.log(`Generation ${attempt} rejected before persistence`);
      if (attempt === 3) throw new Error("AI verification failed after three attempts");
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
