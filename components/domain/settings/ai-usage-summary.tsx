"use client";
import { legalHref } from "@/lib/legal";
import { useInstance } from "@/lib/instance/provider";
import { useLocalization } from "@/lib/localization/provider";

/**
 * «Dove l'app usa l'AI»: the three places where data can reach an AI model, what is sent each time and the switch or
 * checkbox that allows it. Everything not listed here (calculations, rules, bank sync, alerts) never uses AI. Every request
 * asks OpenRouter for zero data retention (`OPENROUTER_PRIVACY` in lib/llm), so the closing line holds on self-hosted installs too;
 * only the link to the privacy policy is hosted-only.
 */

import { AiBadge } from "./ai-badge";

/** One place where the app can use AI: what it is, what is sent, where it is allowed. */
export interface AiUsageItem {
  title: string;
  sent: string;
  where: string;
}

/** The app's AI uses today (default of `AiUsageSummary`). Keep in sync with the consents in import and categorisation. */
export const AI_USAGES: readonly AiUsageItem[] = [
  {
    title: "Proposte di categoria",
    sent: "Invia il nome pulito della controparte, anche se è una persona, per tutti i tipi di movimento, le tue categorie e le tue istruzioni: senza importi, date, IBAN o note.",
    where: "Lo attivi qui sotto, con «Proponi le categorie con l'AI»; vale anche per «Chiedi all'AI» nel dettaglio di un movimento.",
  },
  {
    title: "Importazione di un estratto conto in un formato nuovo",
    sent: "Invia il file intero, per capire come sono fatte le colonne. Con un formato già salvato lo invia solo se la lettura non riesce.",
    where: "Te lo chiede a ogni file, nell'ultimo passo dell'importazione in Liquidità.",
  },
  {
    title: "Importazione degli investimenti, se la lettura non riesce",
    sent: "Invia il file intero, solo per quell'importazione.",
    where: "Solo se spunti la casella nell'importazione in Investimenti.",
  },
];

export function AiUsageSummary({ items = AI_USAGES }: { items?: readonly AiUsageItem[] }) {
  const { t: tr } = useLocalization();
  const { selfHosted } = useInstance();
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-medium text-foreground">{tr("Dove l'app usa l'AI")}</h4>
        <AiBadge />
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.title} className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">{tr(item.title)}</span>
            <span className="text-xs text-muted-foreground">{tr(item.sent)} {tr(item.where)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        {tr("Senza il tuo sì non parte niente. Tutto il resto dell'app (calcoli, regole, sincronizzazione con la banca, avvisi) non usa l'AI.")}
      </p>
      <p className="text-xs text-muted-foreground">
        {tr("Zero data retention: i dati passano da OpenRouter solo verso fornitori che non li conservano dopo la risposta e non li usano per l'addestramento. Se nessuno è disponibile, la richiesta non parte.")}
        {!selfHosted && (
          <>
            {" "}
            <a href={`${legalHref("privacy")}#zero-data-retention`} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              {tr("Come funziona")}
            </a>
          </>
        )}
      </p>
    </div>
  );
}
