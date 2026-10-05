/** Raggruppamento delle transazioni per giorno per la lista di Movimenti (puro, senza dipendenze dalla UI). */

export interface DayGroupInput {
  id: string;
  date: string;
  amount: string;
  excludedAmount: string;
}

export interface DayGroup<T extends DayGroupInput> {
  /** Data ISO `AAAA-MM-GG`. */
  date: string;
  transactions: T[];
  /** Somma con segno degli importi effettivi del giorno (quote escluse con "Dividi" già tolte): negativa = giornata di spesa. */
  net: number;
}

/** Importo effettivo con segno: l'importo meno la quota esclusa (che ha lo stesso segno dell'importo). */
export function effectiveSignedAmount(transaction: Pick<DayGroupInput, "amount" | "excludedAmount">): number {
  return Number(transaction.amount) - Number(transaction.excludedAmount);
}

/** Raggruppa per data, dal giorno più recente; dentro il giorno mantiene l'ordine ricevuto. */
export function groupTransactionsByDay<T extends DayGroupInput>(transactions: readonly T[]): DayGroup<T>[] {
  const byDate = new Map<string, T[]>();
  for (const transaction of transactions) {
    const list = byDate.get(transaction.date);
    if (list) list.push(transaction);
    else byDate.set(transaction.date, [transaction]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, list]) => ({
      date,
      transactions: list,
      net: list.reduce((sum, t) => sum + effectiveSignedAmount(t), 0),
    }));
}

/** Etichetta relativa di un giorno rispetto a oggi: "oggi", "ieri" oppure `null` (si mostra solo la data). */
export function relativeDayKind(isoDate: string, today: Date): "oggi" | "ieri" | null {
  const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isoDate === toIso(today)) return "oggi";
  if (isoDate === toIso(yesterday)) return "ieri";
  return null;
}
