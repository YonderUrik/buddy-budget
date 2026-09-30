import type { Account } from "@/lib/db/schema/accounts";

/** Gruppo di conti mostrato nella lista Conti: una banca oppure i conti tenuti a mano. */
export interface AccountGroup {
  key: string;
  label: string;
  hint: string;
  accounts: Account[];
}

export const MANUAL_GROUP_KEY = "manuali";
export const UNKNOWN_BANK_LABEL = "Banca collegata";

/**
 * Divide i conti in gruppi: un gruppo per banca (in ordine alfabetico, con i conti nell'ordine ricevuto) e, in fondo,
 * i conti manuali. `bankByAccountId` dice a quale banca appartiene ogni conto collegato; se manca si usa un nome generico.
 */
export function groupAccounts(accounts: Account[], bankByAccountId: ReadonlyMap<string, string>): AccountGroup[] {
  const banks = new Map<string, Account[]>();
  const manual: Account[] = [];
  for (const account of accounts) {
    if (account.source !== "auto") {
      manual.push(account);
      continue;
    }
    const bank = bankByAccountId.get(account.id) ?? UNKNOWN_BANK_LABEL;
    banks.set(bank, [...(banks.get(bank) ?? []), account]);
  }
  const groups: AccountGroup[] = [...banks.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "it"))
    .map(([bank, list]) => ({ key: `banca-${bank}`, label: bank, hint: "Si aggiorna da solo", accounts: list }));
  if (manual.length > 0) {
    groups.push({ key: MANUAL_GROUP_KEY, label: "Manuali", hint: "Li aggiorni tu", accounts: manual });
  }
  return groups;
}
