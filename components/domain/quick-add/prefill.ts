import type { TransactionPrefill } from "@/components/domain/expenses";
import type { RegisterOperationInitial } from "@/components/domain/investments";

/** Starting values for a form of «Aggiungi», e.g. read from a sentence typed in «Cerca». The user still checks and saves. */
export interface QuickAddPrefill {
  movimento?: TransactionPrefill;
  operazione?: RegisterOperationInitial;
}
