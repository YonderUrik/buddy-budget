import { buildSyncErrorMessage, buildSyncSummaryMessage } from "@/lib/gocardless/sync-messages";
import { languageOfLocale } from "@/lib/localization/config";
import { translate } from "@/lib/localization/messages";
import type { SyncJobAccount, SyncJobView } from "@/lib/sync-jobs/types";
import type { ProgressBarState } from "@/components/domain/shared";

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

/** Text, bar and tone of an account in the sync panel, by phase, in the language of `locale`. */
export function describeAccountProgress(account: SyncJobAccount, interrupted: boolean, locale = "it-IT"): AccountProgressDescription {
  const t = (source: string, values?: Record<string, number>) => translate(languageOfLocale(locale), source, values);
  switch (account.phase) {
    case "queued":
      return { text: t(QUEUED_TEXT), bar: NO_BAR, tone: "default" };
    case "balance":
      return { text: t(BALANCE_TEXT), bar: { kind: "indeterminate" }, tone: "default" };
    case "fetching":
      return { text: t(FETCHING_TEXT), bar: { kind: "indeterminate" }, tone: "default" };
    case "saving": {
      const total = account.total ?? 0;
      return {
        text: t(total === 1 ? "Importati {0} di {1} movimento" : "Importati {0} di {1} movimenti", { 0: account.processed, 1: total }),
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
        }, locale),
        bar: FULL_BAR,
        tone: "success",
      };
    case "limited":
      return { text: buildSyncErrorMessage({ status: "gocardless-limited" }, locale), bar: NO_BAR, tone: "error" };
    case "expired":
      return { text: buildSyncErrorMessage({ status: "expired" }, locale), bar: NO_BAR, tone: "error" };
    case "error":
      if (account.errorReason === "already-running") {
        return { text: buildSyncErrorMessage({ status: "already-running" }, locale), bar: NO_BAR, tone: "error" };
      }
      return { text: t(interrupted ? INTERRUPTED_TEXT : ERROR_TEXT), bar: NO_BAR, tone: "error" };
  }
}

/** Short title of a job for the panel header, in the language of `locale`. */
export function describeJobTitle(job: SyncJobView, locale = "it-IT"): string {
  const t = (source: string, values?: Record<string, number>) => translate(languageOfLocale(locale), source, values);
  if (job.interrupted) return t("Sincronizzazione interrotta");
  if (job.status === "done") return t("Sincronizzazione completata");
  if (job.status === "failed") return t("Sincronizzazione non riuscita");
  const count = job.accounts.length;
  return t(count === 1 ? "Sincronizzazione in corso · {0} conto" : "Sincronizzazione in corso · {0} conti", { 0: count });
}
