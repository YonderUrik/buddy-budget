import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { transactions } from "@/lib/db/schema/transactions";
import type { Debt, DebtEvent } from "@/lib/db/schema/debts";
import type { CreateDebtEventInput } from "@/lib/validation/debts";
import { todayIso } from "./dates";
import { buildDebtsView } from "./view";

/**
 * Controlla che un nuovo evento sia applicabile al debito: un pagamento deve riferirsi a una rata esistente e non ancora
 * pagata, un cambio tasso o una correzione devono cadere prima dell'ultima rata. Restituisce il messaggio d'errore o null.
 */
export function checkEventApplicable(debt: Debt, events: DebtEvent[], input: CreateDebtEventInput): string | null {
  if (debt.kind !== "loan") return "Questo debito non accetta eventi";
  if (!LOAN_EVENT_TYPES.includes(input.type)) return "Questo evento non vale per un finanziamento";
  if (input.type === "balance_correction" && input.amount <= 0) return "Il residuo deve essere maggiore di zero";
  const { debts } = buildDebtsView([debt], events, todayIso());
  const rows = debts[0].plan.rows;
  if (input.type === "payment") {
    const row = rows.find((r) => r.number === input.installmentNumber);
    if (!row) return "Questa rata non esiste";
    if (row.status === "pagata") return "Questa rata è già segnata come pagata";
    return null;
  }
  if (!rows.some((r) => r.dueDate > input.date)) return "La data è dopo l'ultima rata del piano";
  if (input.type === "early_repayment" && debts[0].plan.totals.closedOn) return "Il debito è già stato estinto";
  return null;
}

const LOAN_EVENT_TYPES: CreateDebtEventInput["type"][] = ["payment", "rate_change", "balance_correction", "early_repayment"];
/** True se la transazione esiste ed è dell'utente. */
export async function ownsTransaction(userId: string, transactionId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(and(eq(transactions.id, transactionId), eq(transactions.userId, userId)));
  return Boolean(row);
}
