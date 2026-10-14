import { z } from "zod";
import { addMonths, endOfMonth, startOfMonth } from "@/lib/calc/expenses";

/** Periodi pronti tra cui scegliere (mesi interi più recenti). */
export const DATA_PERIOD_PRESETS = [12, 24] as const;
/** Il periodo personalizzato va da 3 mesi (sotto, una media annua dice poco) a 10 anni. */
export const CUSTOM_PERIOD_LIMITS = { minMonths: 3, maxMonths: 120 } as const;

const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mese non valido");

/** Mesi da `from` a `to` compresi (chiavi AAAA-MM). */
export function monthSpan(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

/** Periodo dei dati da cui Analitiche ricava spesa, risparmio e rendimento: gli ultimi 12 o 24 mesi, o mesi scelti. */
export const dataPeriodSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("ultimi"), months: z.union([z.literal(12), z.literal(24)]) }),
  z
    .object({ kind: z.literal("personalizzato"), from: monthKey, to: monthKey })
    .refine((p) => monthSpan(p.from, p.to) >= CUSTOM_PERIOD_LIMITS.minMonths, { message: `Scegli almeno ${CUSTOM_PERIOD_LIMITS.minMonths} mesi` })
    .refine((p) => monthSpan(p.from, p.to) <= CUSTOM_PERIOD_LIMITS.maxMonths, { message: "Scegli al massimo 10 anni" }),
]);

export type DataPeriod = z.infer<typeof dataPeriodSchema>;

export const DEFAULT_DATA_PERIOD: DataPeriod = { kind: "ultimi", months: 12 };

/** Intervallo di date di un periodo, in mesi interi: il mese in corso (parziale) non conta mai. */
export interface PeriodRange {
  from: Date;
  to: Date;
  /** Mesi interi nel periodo (un periodo personalizzato che arriva al mese in corso si ferma al mese prima). */
  months: number;
}

/** Mesi interi del periodo scelto, rispetto a oggi. */
export function resolvePeriodRange(period: DataPeriod, today: Date): PeriodRange {
  const lastFull = endOfMonth(addMonths(today, -1));
  if (period.kind === "ultimi") {
    return { from: startOfMonth(addMonths(lastFull, -(period.months - 1))), to: lastFull, months: period.months };
  }
  const [fy, fm] = period.from.split("-").map(Number);
  const [ty, tm] = period.to.split("-").map(Number);
  const from = new Date(fy, fm - 1, 1);
  const wantedTo = endOfMonth(new Date(ty, tm - 1, 1));
  const to = wantedTo > lastFull ? lastFull : wantedTo;
  const months = to < from ? 0 : (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  return { from, to, months };
}

/** Chiave AAAA-MM di una data. */
export function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Tipo del periodo per log ed eventi (solo categorico). */
export type DataPeriodKind = "ultimi-12" | "ultimi-24" | "personalizzato";

export function dataPeriodKind(period: DataPeriod): DataPeriodKind {
  return period.kind === "personalizzato" ? "personalizzato" : period.months === 24 ? "ultimi-24" : "ultimi-12";
}
