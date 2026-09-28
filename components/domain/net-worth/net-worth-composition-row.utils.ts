import type { Account } from "@/lib/db/schema/accounts";

/** Voce della riga di composizione del patrimonio: una per classe di asset esistente. */
export interface NetWorthCompositionItem {
  key: string;
  label: string;
  detail: string;
  amount: number;
  href: string;
}

/** Riepilogo degli investimenti per la composizione (null se l'utente non ha operazioni). */
export interface InvestmentsComposition {
  value: number;
  positions: number;
}

/** Voci di composizione per le sole classi di asset presenti: Liquidità (se ci sono conti) e Investimenti. */
export function buildCompositionItems(
  accounts: Account[],
  investments: InvestmentsComposition | null = null
): NetWorthCompositionItem[] {
  const items: NetWorthCompositionItem[] = [];
  if (accounts.length > 0) {
    const amount = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
    const detail = accounts.length === 1 ? "1 conto" : `${accounts.length} conti`;
    items.push({ key: "liquidita", label: "Liquidità", detail, amount, href: "/conti" });
  }
  if (investments) {
    const detail = investments.positions === 1 ? "1 posizione" : `${investments.positions} posizioni`;
    items.push({ key: "investimenti", label: "Investimenti", detail, amount: investments.value, href: "/investimenti" });
  }
  return items;
}
