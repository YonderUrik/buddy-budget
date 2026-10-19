import { emailLocale, renderEmail } from "@/lib/email";
import type { Language } from "@/lib/localization/config";
import { importOverlap, type ImportCounts } from "./counts";

export type PersonalImportEmailOutcome = "imported" | "review" | "failed";
/** Subject, text and HTML of the email on the outcome of the personal CSV import, in `params.language` (Italian by default). Pure, so it can be tested. */
export function personalImportEmailContent(
  outcome: PersonalImportEmailOutcome,
  params: { jobUrl: string; appUrl: string; language?: Language; counts?: Partial<ImportCounts> },
): { subject: string; text: string; html: string } {
  const { t, language } = emailLocale(params.language);
  const options = { appUrl: params.appUrl, language };
  const overlap = outcome === "imported" ? importOverlap(params.counts) : "unknown";
  if (overlap === "nothing_new") {
    return {
      subject: t("Il tuo CSV non aveva movimenti nuovi"),
      ...renderEmail(
        {
          title: t("Niente di nuovo da importare"),
          lead: t("Tutti i movimenti del tuo CSV c'erano già: non abbiamo aggiunto niente."),
          cta: { label: t("Apri BuddyBudget"), url: params.jobUrl },
        },
        options,
      ),
    };
  }
  if (overlap === "partial") {
    const { rows, alreadyPresent } = params.counts as ImportCounts;
    return {
      subject: t("Il tuo CSV è stato importato"),
      ...renderEmail(
        {
          title: t("Importazione completata"),
          lead: t("{0} su {1} movimenti importati: gli altri c'erano già. Trovi i dati in **Liquidità** e **Investimenti**.", rows - alreadyPresent, rows),
          cta: { label: t("Apri BuddyBudget"), url: params.jobUrl },
        },
        options,
      ),
    };
  }
  if (outcome === "imported") {
    return {
      subject: t("Il tuo CSV è stato importato"),
      ...renderEmail(
        {
          title: t("Importazione completata"),
          lead: t("Il tuo CSV è stato importato. Trovi i dati in **Liquidità** e **Investimenti**."),
          cta: { label: t("Apri BuddyBudget"), url: params.jobUrl },
        },
        options,
      ),
    };
  }
  if (outcome === "review") {
    return {
      subject: t("Il tuo CSV ha righe da controllare"),
      ...renderEmail(
        {
          title: t("Alcune righe da controllare"),
          lead: t("Alcune righe del tuo CSV non sono state riconosciute e nessun movimento è stato salvato. In BuddyBudget vedi quali righe e perché, e scegli se importare le altre, rianalizzare il file o caricarne uno corretto."),
          cta: { label: t("Vedi le righe"), url: params.jobUrl },
        },
        options,
      ),
    };
  }
  return {
    subject: t("Non è stato possibile importare il tuo CSV"),
    ...renderEmail(
      {
        title: t("Importazione non riuscita"),
        lead: t("Non è stato possibile importare il tuo CSV: nessun movimento è stato salvato. Apri BuddyBudget per vedere il motivo."),
        cta: { label: t("Vedi il motivo"), url: params.jobUrl },
      },
      options,
    ),
  };
}
