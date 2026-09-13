import type { Account } from "@/lib/db/schema/accounts";

/** Voce della riga di composizione del patrimonio: una per classe di asset esistente. */
export interface NetWorthCompositionItem {
  key: string;
  label: string;
  detail: string;
  amount: number;
  href: string;
}

/** Voci di composizione per le sole classi di asset presenti; oggi solo Liquidità, se l'utente ha almeno un conto. */
export function buildCompositionItems(accounts: Account[]): NetWorthCompositionItem[] {
  if (accounts.length === 0) return [];
  const amount = accounts.reduce((sum, a) => sum + Number(a.balance), 0);
  const detail = accounts.length === 1 ? "1 conto" : `${accounts.length} conti`;
  return [{ key: "liquidita", label: "Liquidità", detail, amount, href: "/conti" }];
}
