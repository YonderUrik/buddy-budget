import { ProviderBlockedError } from "../errors";
import { providerGet } from "../http";
import type { DailyClose, PriceProvider } from "../types";

const STOOQ_URL = "https://stooq.com/q/d/l/";

/** Converte il CSV di Stooq (`Date,Open,High,Low,Close,Volume`); la valuta non è dichiarata. */
export function parseStooqCsv(csv: string): DailyClose[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  if (/apikey/i.test(lines[0])) throw new ProviderBlockedError("stooq");
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const dateCol = header.indexOf("date");
  const closeCol = header.indexOf("close");
  if (dateCol < 0 || closeCol < 0) return []; // "No data" e simili
  return lines.slice(1).map((line) => {
    const fields = line.split(",");
    return { date: fields[dateCol], close: Number(fields[closeCol]), currency: null };
  });
}

/** Stooq: CSV giornalieri, riserva per ETF e azioni. Dal 2026 richiede una `apikey` (ottenuta una volta via captcha). */
export const stooqProvider: PriceProvider = {
  id: "stooq",
  requiredKeyEnv: "STOOQ_API_KEY",
  maxHistory: "unlimited",
  minDelayMs: 1_000,
  async fetchDailyCloses(symbol, from, to, ctx) {
    const d1 = from.replaceAll("-", "");
    const d2 = to.replaceAll("-", "");
    const url = `${STOOQ_URL}?s=${encodeURIComponent(symbol)}&d1=${d1}&d2=${d2}&i=d&apikey=${encodeURIComponent(ctx.env.STOOQ_API_KEY ?? "")}`;
    const response = await providerGet("stooq", url, ctx, { notFoundAsNull: true });
    return response ? parseStooqCsv(await response.text()) : [];
  },
};
