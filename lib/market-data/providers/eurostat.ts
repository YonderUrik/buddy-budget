import { ProviderError } from "../errors";
import { providerGet, readJson } from "../http";
import type { ProviderContext } from "../types";

const EUROSTAT_HICP_URL = "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_minr";

/** Indice dei prezzi di un mese (`month` = `YYYY-MM`). */
export interface MonthlyIndexValue {
  month: string;
  value: number;
}

/** Fonte dell'indice mensile dei prezzi al consumo. */
export interface InflationProvider {
  id: "eurostat";
  /** Identifies a compatible dataset and reference base in persisted observations. */
  seriesKey: string;
  /** Indici mensili dell'area da `fromMonth` (`YYYY-MM`) all'ultimo pubblicato. */
  fetchMonthlyIndex(area: string, fromMonth: string, ctx: ProviderContext): Promise<MonthlyIndexValue[]>;
}

/** Risposta JSON-stat di Eurostat, solo i campi che servono. */
interface JsonStat {
  id?: string[];
  size?: number[];
  value?: Record<string, number | null>;
  dimension?: Record<string, { category?: { index?: Record<string, number> } }>;
}

/** "2026-08" o "2026M08" → "2026-08"; null se non è un mese. */
function normalizeMonth(label: string): string | null {
  const match = /^(\d{4})(?:-|M)(\d{2})$/.exec(label);
  return match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? `${match[1]}-${match[2]}` : null;
}

/**
 * Converte il JSON-stat di Eurostat in indici mensili. Con area, voce e unità fissate l'unica dimensione con più
 * valori è il tempo, quindi la posizione del tempo è la chiave del valore.
 */
export function parseEurostatHicp(body: JsonStat): MonthlyIndexValue[] {
  if (body.id && body.size && body.id.some((id, i) => id !== "time" && body.size![i] !== 1)) {
    throw new ProviderError("eurostat", "expected one inflation series");
  }
  const timeIndex = body.dimension?.time?.category?.index;
  if (!timeIndex || !body.value) throw new ProviderError("eurostat", "unexpected json-stat");
  const values: MonthlyIndexValue[] = [];
  for (const [label, position] of Object.entries(timeIndex)) {
    const month = normalizeMonth(label);
    const value = body.value[String(position)];
    if (month && typeof value === "number" && Number.isFinite(value) && value > 0) values.push({ month, value });
  }
  return values.sort((a, b) => a.month.localeCompare(b.month));
}

/** Eurostat HICP (`prc_hicp_minr`): indice generale (TOTAL), base 2025=100, mensile. Nessuna chiave. */
export const eurostatProvider: InflationProvider = {
  id: "eurostat",
  seriesKey: "eurostat:prc_hicp_minr:I25:TOTAL",
  async fetchMonthlyIndex(area, fromMonth, ctx) {
    const params = new URLSearchParams({ format: "JSON", lang: "EN", geo: area, freq: "M", coicop18: "TOTAL", unit: "I25", sinceTimePeriod: fromMonth });
    const response = await providerGet("eurostat", `${EUROSTAT_HICP_URL}?${params}`, ctx, { notFoundAsNull: true });
    if (!response) return [];
    const body = await readJson<JsonStat>("eurostat", response);
    for (const [dimension, expected] of Object.entries({ geo: area, unit: "I25", coicop18: "TOTAL", freq: "M" })) {
      const keys = Object.keys(body.dimension?.[dimension]?.category?.index ?? {});
      if (keys.length !== 1 || keys[0] !== expected) throw new ProviderError("eurostat", "unexpected inflation series");
    }
    return parseEurostatHicp(body);
  },
};
