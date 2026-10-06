import type { Account } from "@/lib/db/schema/accounts";
import { ASSET_CLASS_LABELS } from "./asset-classes";

/** Etichetta della riga di sintesi degli investimenti: quanto ha aggiunto (o tolto) il mercato. */
export const MARKET_HIGHLIGHT_LABEL = "dal mercato";

/** Una cifra di sintesi da mostrare sotto una voce (es. il guadagno di mercato degli investimenti). */
export interface CompositionHighlight {
  amount: number;
  /** Variazione relativa (es. 0,12 = +12%), null se non calcolabile. */
  ratio: number | null;
  label: string;
}

/** Voce della composizione del patrimonio: una per classe di asset esistente. */
export interface NetWorthCompositionItem {
  key: string;
  label: string;
  detail: string;
  amount: number;
  /** Peso sul patrimonio (0-1), calcolato sulle sole voci positive. */
  share: number;
  href: string;
  highlight?: CompositionHighlight;
  /** Voce in negativo (debiti): non entra nei pesi e non ha una quota da mostrare. */
  isLiability?: boolean;
}

/** Riepilogo degli investimenti per la composizione (null se l'utente non ha operazioni). */
export interface InvestmentsComposition {
  value: number;
  positions: number;
  /** Quanto hai pagato per quello che possiedi oggi. */
  paid: number;
  /** Guadagno (o perdita) non realizzato: valore meno pagato. */
  marketGain: number;
}

/** Riepilogo dei debiti per la composizione (null se l'utente non ne ha). */
export interface DebtsComposition {
  /** Debito complessivo oggi (positivo): residuo dei finanziamenti. */
  total: number;
  count: number;
}

/** Riepilogo della previdenza per la composizione (null se l'utente non ha fondi con fotografie). */
export interface PensionComposition {
  /** Valore complessivo oggi: ultima fotografia di ogni fondo. */
  value: number;
  funds: number;
  /** Escluso dal patrimonio dall'utente: resta in elenco ma non pesa sulle quote. */
  excluded?: boolean;
}

const PENSION_EXCLUDED_DETAIL = "fuori dal totale";

/** Voci di composizione per le sole classi presenti: Liquidità (se ci sono conti), Investimenti, Previdenza e Debiti (in negativo). */
export function buildCompositionItems(
  accounts: Account[],
  investments: InvestmentsComposition | null = null,
  debts: DebtsComposition | null = null,
  pension: PensionComposition | null = null
): NetWorthCompositionItem[] {
  const items: Omit<NetWorthCompositionItem, "share">[] = [];
  if (accounts.length > 0) {
    const amount = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const detail = accounts.length === 1 ? "1 conto" : `${accounts.length} conti`;
    items.push({ key: "liquidita", label: ASSET_CLASS_LABELS.liquidita, detail, amount, href: "/conti" });
  }
  if (investments) {
    const detail = investments.positions === 1 ? "1 posizione" : `${investments.positions} posizioni`;
    items.push({
      key: "investimenti",
      label: ASSET_CLASS_LABELS.investimenti,
      detail,
      amount: investments.value,
      href: "/investimenti",
      highlight: {
        amount: investments.marketGain,
        ratio: investments.paid > 0 ? investments.marketGain / investments.paid : null,
        label: MARKET_HIGHLIGHT_LABEL,
      },
    });
  }
  if (pension && pension.value > 0) {
    items.push({
      key: "previdenza",
      label: ASSET_CLASS_LABELS.previdenza,
      detail: `${pension.funds === 1 ? "1 fondo" : `${pension.funds} fondi`}${pension.excluded ? ` · ${PENSION_EXCLUDED_DETAIL}` : ""}`,
      amount: pension.value,
      href: "/pensione",
    });
  }
  const liabilities: NetWorthCompositionItem[] = [];
  if (debts && debts.total > 0) {
    liabilities.push({
      key: "debiti",
      label: ASSET_CLASS_LABELS.debiti,
      detail: debts.count === 1 ? "1 debito" : `${debts.count} debiti`,
      amount: -debts.total,
      share: 0,
      href: "/debiti",
      isLiability: true,
    });
  }
  const counts = (item: Omit<NetWorthCompositionItem, "share">) => !(item.key === "previdenza" && pension?.excluded);
  const positiveTotal = items.reduce((sum, i) => sum + (counts(i) ? Math.max(0, i.amount) : 0), 0);
  return [
    ...items.map((item) => ({
      ...item,
      share: positiveTotal > 0 && counts(item) ? Math.max(0, item.amount) / positiveTotal : 0,
    })),
    ...liabilities,
  ];
}

/** Quota del patrimonio investita (0-1), null se non ci sono entrambe le classi (la frase non direbbe nulla). */
export function computeInvestedShare(items: NetWorthCompositionItem[]): number | null {
  const assets = items.filter((i) => !i.isLiability);
  if (assets.length < 2) return null;
  return items.find((i) => i.key === "investimenti")?.share ?? null;
}
