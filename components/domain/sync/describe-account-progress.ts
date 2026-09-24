import { buildSyncErrorMessage, buildSyncSummaryMessage } from "@/lib/gocardless/sync-messages";
import type { SyncJobAccount, SyncJobView } from "@/lib/sync-jobs/types";

export type ProgressBarState =
  | { kind: "none" }
  | { kind: "indeterminate" }
  | { kind: "determinate"; value: number; max: number };

export interface AccountProgressDescription {
  text: string;
  bar: ProgressBarState;
  tone: "default" | "success" | "error";
}

const QUEUED_TEXT = "In attesa";
const BALANCE_TEXT = "Aggiorno il saldo…";
const FETCHING_TEXT = "Scarico i movimenti dalla banca…";
const ERROR_TEXT = "Sincronizzazione non riuscita. Riprova più tardi.";
const INTERRUPTED_TEXT = "Sincronizzazione interrotta. I movimenti già salvati restano, il prossimo sync riprende da lì.";

const NO_BAR: ProgressBarState = { kind: "none" };
const FULL_BAR: ProgressBarState = { kind: "determinate", value: 1, max: 1 };

/** Testo, barra e tono di un conto nel pannello di sincronizzazione, in base alla fase. */
export function describeAccountProgress(account: SyncJobAccount, interrupted: boolean): AccountProgressDescription {
  switch (account.phase) {
    case "queued":
      return { text: QUEUED_TEXT, bar: NO_BAR, tone: "default" };
    case "balance":
      return { text: BALANCE_TEXT, bar: { kind: "indeterminate" }, tone: "default" };
    case "fetching":
      return { text: FETCHING_TEXT, bar: { kind: "indeterminate" }, tone: "default" };
    case "saving": {
      const total = account.total ?? 0;
      const noun = total === 1 ? "movimento" : "movimenti";
      return {
        text: `Importati ${account.processed} di ${total} ${noun}`,
        bar: { kind: "determinate", value: account.processed, max: Math.max(total, 1) },
        tone: "default",
      };
    }
    case "done":
      return {
        text: buildSyncSummaryMessage({
          status: "synced",
          newTransactionsCount: account.inserted,
          categorizedCount: account.categorized,
          uncategorizedCount: account.uncategorized,
          balanceUpdated: true,
        }),
        bar: FULL_BAR,
        tone: "success",
      };
    case "limited":
      return { text: buildSyncErrorMessage({ status: "gocardless-limited" }), bar: NO_BAR, tone: "error" };
    case "expired":
      return { text: buildSyncErrorMessage({ status: "expired" }), bar: NO_BAR, tone: "error" };
    case "error":
      if (account.errorReason === "already-running") {
        return { text: buildSyncErrorMessage({ status: "already-running" }), bar: NO_BAR, tone: "error" };
      }
      return { text: interrupted ? INTERRUPTED_TEXT : ERROR_TEXT, bar: NO_BAR, tone: "error" };
  }
}

/** Titolo sintetico di un job per l'intestazione del pannello. */
export function describeJobTitle(job: SyncJobView): string {
  if (job.interrupted) return "Sincronizzazione interrotta";
  if (job.status === "done") return "Sincronizzazione completata";
  if (job.status === "failed") return "Sincronizzazione non riuscita";
  const count = job.accounts.length;
  return `Sincronizzazione in corso · ${count} ${count === 1 ? "conto" : "conti"}`;
}
