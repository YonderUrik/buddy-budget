import type { BenchmarkComparison } from "@/lib/calc/returns";
import type { BackfillStateView } from "@/lib/market-data/backfill-state";

/** Esito del confronto tra portafoglio e benchmark. */
export type BenchmarkVerdict = "better" | "worse" | "even";

/** Perché il confronto col benchmark non c'è ancora, per dire all'utente cosa succede e cosa può fare. */
export type BenchmarkWait =
  /** Stato del recupero non ancora letto (subito dopo la scelta). */
  | { kind: "checking" }
  /** Prezzi in arrivo: `total` è null finché la fonte non ha risposto. */
  | { kind: "downloading"; saved: number; total: number | null }
  /** Recupero fallito o interrotto: si può riprovare. */
  | { kind: "failed" }
  /** Lo strumento ha prezzi solo da una data successiva all'inizio del periodo. */
  | { kind: "no_history"; firstPriceDate: string }
  /** Prezzi presenti ma incompleti (es. manca il cambio): si può riprovare. */
  | { kind: "incomplete" };
import { translate, type MessageValues } from "@/lib/localization/messages";
import { type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedReturnInsights(language: Language) {

  const tr = (source: string, values?: MessageValues) => translate(language, source, values);
const RETURN_DIFFERENCE_THRESHOLD = 0.01;

/**
 * Cosa dice la differenza tra rendimento del portafoglio (TWR) e dei tuoi soldi (money-weighted): se i tuoi soldi
 * rendono meno, hai versato di più quando i prezzi erano alti (o prima di un calo). Null se la differenza è piccola.
 */
function timingInsight(twr: number | null, moneyWeighted: number | null): string | null {
  if (twr === null || moneyWeighted === null) return null;
  const diff = moneyWeighted - twr;
  if (Math.abs(diff) < RETURN_DIFFERENCE_THRESHOLD) return null;
  return diff < 0
    ? tr("I tuoi soldi hanno reso meno del portafoglio: hai versato di più quando i prezzi erano più alti.")
    : tr("I tuoi soldi hanno reso più del portafoglio: hai versato di più quando i prezzi erano più bassi.");
}

/** Il portafoglio ha fatto meglio o peggio del benchmark, confrontando i valori finali a parità di versamenti. */
function benchmarkVerdict(comparison: Pick<BenchmarkComparison, "simulatedValue" | "portfolioValue">): BenchmarkVerdict {
  const base = Math.max(Math.abs(comparison.simulatedValue), 1);
  const diff = (comparison.portfolioValue - comparison.simulatedValue) / base;
  if (Math.abs(diff) < RETURN_DIFFERENCE_THRESHOLD) return "even";
  return diff > 0 ? "better" : "worse";
}

/**
 * Stato dell'attesa del confronto. `backfill` è lo stato del recupero dello storico del benchmark: undefined se non
 * ancora letto, null se su Redis non c'è (mai partito o scaduto). `firstPriceDate` è il primo prezzo caricato del
 * benchmark, `baseKey` il giorno da cui parte il periodo.
 */
function benchmarkWait(params: {
  backfill: BackfillStateView | null | undefined;
  firstPriceDate: string | null;
  baseKey: string;
}): BenchmarkWait {
  const { backfill, firstPriceDate, baseKey } = params;
  if (backfill === undefined) return { kind: "checking" };
  if (backfill?.status === "running" && !backfill.interrupted) {
    return { kind: "downloading", saved: backfill.saved, total: backfill.total };
  }
  const failed = backfill?.status === "failed" || backfill?.interrupted === true;
  if (firstPriceDate === null) return { kind: "failed" };
  if (firstPriceDate > baseKey) {
    // "Prezzi solo da…" è vero solo se un recupero completo è finito: uno fallito, interrotto o scaduto lascia lo
    // storico a metà (es. i soli 30 giorni scaricati alla creazione dello strumento) e va riprovato.
    if (failed) return { kind: "failed" };
    return backfill?.status === "done" ? { kind: "no_history", firstPriceDate } : { kind: "incomplete" };
  }
  return failed ? { kind: "failed" } : { kind: "incomplete" };
}
  return { RETURN_DIFFERENCE_THRESHOLD, timingInsight, benchmarkVerdict, benchmarkWait };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { RETURN_DIFFERENCE_THRESHOLD, timingInsight, benchmarkVerdict, benchmarkWait } = localizedReturnInsights("it");
