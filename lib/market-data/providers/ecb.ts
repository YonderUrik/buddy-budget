import { ProviderError } from "../errors";
import { providerGet } from "../http";
import type { FxDailyRate, FxProvider } from "../types";

const ECB_URL = "https://data-api.ecb.europa.eu/service/data/EXR/";

/** Divide una riga CSV rispettando i campi tra virgolette. */
export function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      fields.push(current);
      current = "";
    } else current += char;
  }
  fields.push(current);
  return fields;
}

/** Converte il CSV della BCE (`format=csvdata`) in cambi; le colonne si trovano per nome, non per posizione. */
export function parseEcbCsv(csv: string): FxDailyRate[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]);
  const currencyCol = header.indexOf("CURRENCY");
  const dateCol = header.indexOf("TIME_PERIOD");
  const valueCol = header.indexOf("OBS_VALUE");
  if (currencyCol < 0 || dateCol < 0 || valueCol < 0) throw new ProviderError("ecb", "unexpected csv header");
  const rates: FxDailyRate[] = [];
  for (const line of lines.slice(1)) {
    const fields = splitCsvLine(line);
    const perEur = Number(fields[valueCol]);
    if (!fields[valueCol] || !Number.isFinite(perEur) || perEur <= 0) continue;
    rates.push({ date: fields[dateCol], currency: fields[currencyCol], perEur });
  }
  return rates;
}

/** Banca Centrale Europea: cambi di riferimento giornalieri (fonte ufficiale). */
export const ecbProvider: FxProvider = {
  id: "ecb",
  async fetchRates(currencies, from, to, ctx) {
    const wanted = currencies.filter((c) => c !== "EUR");
    if (wanted.length === 0) return [];
    const url = `${ECB_URL}D.${wanted.join("+")}.EUR.SP00.A?startPeriod=${from}&endPeriod=${to}&format=csvdata`;
    // 404 = nessun dato nel periodo (es. solo giorni festivi).
    const response = await providerGet("ecb", url, ctx, { notFoundAsNull: true });
    return response ? parseEcbCsv(await response.text()) : [];
  },
};
