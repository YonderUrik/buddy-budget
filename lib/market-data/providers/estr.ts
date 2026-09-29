import { ProviderError } from "../errors";
import { providerGet } from "../http";
import { splitCsvLine } from "./ecb";
import type { ProviderContext } from "../types";

const ESTR_URL = "https://data-api.ecb.europa.eu/service/data/EST/B.EU000A2X2A25.WT";

/** Tasso di un giorno come frazione annua (0,0192 = 1,92%). */
export interface DailyRate {
  date: string;
  rate: number;
}

/** Fonte di un tasso d'interesse di riferimento giornaliero. */
export interface RateProvider {
  id: "ecb";
  /** Tassi giornalieri tra `from` e `to` inclusi (YYYY-MM-DD). */
  fetchDailyRates(from: string, to: string, ctx: ProviderContext): Promise<DailyRate[]>;
}

/** Converte il CSV della BCE (`format=csvdata`) della serie €STR: le colonne si trovano per nome, valori in %. */
export function parseEstrCsv(csv: string): DailyRate[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);
  const dateCol = header.indexOf("TIME_PERIOD");
  const valueCol = header.indexOf("OBS_VALUE");
  if (dateCol < 0 || valueCol < 0) throw new ProviderError("ecb", "unexpected csv header");
  const rates: DailyRate[] = [];
  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line);
    const percent = Number(fields[valueCol]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fields[dateCol] ?? "") || fields[valueCol] === "" || !Number.isFinite(percent)) continue;
    rates.push({ date: fields[dateCol], rate: percent / 100 });
  }
  return rates;
}

/** €STR (Euro short-term rate) dalla Data API della BCE: fonte ufficiale, senza chiave. */
export const estrProvider: RateProvider = {
  id: "ecb",
  async fetchDailyRates(from, to, ctx) {
    const response = await providerGet("ecb", `${ESTR_URL}?startPeriod=${from}&endPeriod=${to}&format=csvdata`, ctx, {
      notFoundAsNull: true,
    });
    return response ? parseEstrCsv(await response.text()) : [];
  },
};
