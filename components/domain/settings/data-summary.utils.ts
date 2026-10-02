import type { UserDataSummary } from "@/lib/account/lifecycle";

export interface DataSummaryItem {
  label: string;
  value: number;
}

/** Voci del riepilogo dati in ordine di lettura, con etichetta al singolare o al plurale. Le voci a zero restano (dicono "niente"). */
export function dataSummaryItems(summary: UserDataSummary): DataSummaryItem[] {
  const item = (value: number, singular: string, plural: string): DataSummaryItem => ({
    value,
    label: value === 1 ? singular : plural,
  });
  return [
    item(summary.accounts, "conto", "conti"),
    item(summary.bankConnections, "banca collegata", "banche collegate"),
    item(summary.transactions, "transazione", "transazioni"),
    item(summary.categories, "categoria", "categorie"),
    item(summary.rules, "regola di categorizzazione", "regole di categorizzazione"),
    item(summary.budgets, "budget", "budget"),
    item(summary.investmentOperations, "operazione di investimento", "operazioni di investimento"),
    item(summary.investmentPlans, "piano di accumulo", "piani di accumulo"),
    item(summary.debts, "debito", "debiti"),
    item(summary.pensionFunds, "fondo pensione", "fondi pensione"),
    item(summary.netWorthDays, "giorno di storico del patrimonio", "giorni di storico del patrimonio"),
  ];
}
