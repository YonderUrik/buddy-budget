import type { Account } from "@/lib/db/schema/accounts";

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

/** Voci di composizione per le sole classi di asset presenti: Liquidità (se ci sono conti) e Investimenti. */
export function buildCompositionItems(
  accounts: Account[],
  investments: InvestmentsComposition | null = null
): NetWorthCompositionItem[] {
  const items: Omit<NetWorthCompositionItem, "share">[] = [];
  if (accounts.length > 0) {
    const amount = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const detail = accounts.length === 1 ? "1 conto" : `${accounts.length} conti`;
    items.push({ key: "liquidita", label: "Liquidità", detail, amount, href: "/conti" });
  }
  if (investments) {
    const detail = investments.positions === 1 ? "1 posizione" : `${investments.positions} posizioni`;
    items.push({
      key: "investimenti",
      label: "Investimenti",
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
  const positiveTotal = items.reduce((sum, i) => sum + Math.max(0, i.amount), 0);
  return items.map((item) => ({ ...item, share: positiveTotal > 0 ? Math.max(0, item.amount) / positiveTotal : 0 }));
}

/** Quota del patrimonio investita (0-1), null se non ci sono entrambe le classi (la frase non direbbe nulla). */
export function computeInvestedShare(items: NetWorthCompositionItem[]): number | null {
  if (items.length < 2) return null;
  return items.find((i) => i.key === "investimenti")?.share ?? null;
}
