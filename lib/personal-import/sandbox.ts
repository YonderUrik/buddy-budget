import "server-only";
import { spawn } from "node:child_process";
import { join } from "node:path";
import { parseDate } from "@/lib/investments/import/values";
import { type PersonalParser, type PersonalTable, validateOutcomes } from "./contract";
export async function executeParser(parser: PersonalParser, table: PersonalTable) {
  if (parser.kind === "mapping") {
    const number = (value: string) => {
      const normalized = value.trim().replaceAll(parser.decimal === "," ? "." : ",", "").replace(",", ".");
      if (!/^[+-]?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error("Importo non valido");
      return Number(normalized);
    };
    return validateOutcomes(table.rows.map((r, row) => ({ row, kind: "cash", date: parseDate(r[parser.dateColumn] ?? "", parser.dateOrder), amount: number(r[parser.amountColumn] ?? ""), description: r[parser.descriptionColumn], currency: parser.currencyColumn === null ? parser.currency : r[parser.currencyColumn], transfer: false })), table);
  }
  const raw = await new Promise<unknown>((resolve, reject) => {
    const child = spawn(process.execPath, ["--max-old-space-size=512", join(process.cwd(), "scripts/personal-csv-sandbox.mjs")], { env: { NODE_ENV: "production" }, stdio: ["pipe", "pipe", "ignore"] });
    let output = "", settled = false;
    const finish = (error?: Error) => { if (settled) return; settled = true; clearTimeout(timer); if (error) { child.kill("SIGKILL"); reject(error); } else { try { resolve(JSON.parse(output)); } catch { reject(new Error("Risultato del parser non valido")); } } };
    const timer = setTimeout(() => finish(new Error("Tempo massimo del parser superato")), 6000);
    child.on("error", () => finish(new Error("Sandbox non disponibile")));
    child.stdout.on("data", chunk => { output += chunk; if (Buffer.byteLength(output) > 64 * 1024 * 1024) finish(new Error("Risultato troppo grande")); });
    child.stdin.on("error", () => finish(new Error("Parser non valido")));
    child.on("close", code => finish(code === 0 ? undefined : new Error("Parser interrotto: codice non valido o limiti superati")));
    child.stdin.end(JSON.stringify({ code: parser.code, table }));
  });
  return validateOutcomes(raw, table);
}
