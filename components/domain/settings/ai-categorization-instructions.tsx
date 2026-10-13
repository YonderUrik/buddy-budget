"use client";
import { useLocalization } from "@/lib/localization/provider";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateAiCategorizationMutation } from "@/lib/queries/notifications";
import { track } from "@/lib/analytics";

/** Preferenze personali inviate all'assistente solo quando la categorizzazione AI è attiva. */
export function AiCategorizationInstructions({ saved }: { saved: string }) {
  const { t: tr } = useLocalization();
  const [draft, setDraft] = React.useState<string | null>(null);
  const [savedNotice, setSavedNotice] = React.useState(false);
  const update = useUpdateAiCategorizationMutation();
  const value = draft ?? saved;
  const dirty = value.trim() !== saved;
  return (
    <form className="mt-5 flex flex-col gap-2" onSubmit={(event) => {
      event.preventDefault();
      update.mutate({ instructions: value }, { onSuccess: () => {
        setDraft(null);
        setSavedNotice(true);
        track("ai_categorization_instructions_saved");
      } });
    }}>
      <label htmlFor="ai-category-instructions" className="text-sm font-medium">{tr("Le tue istruzioni per l’AI")}</label>
      <p id="ai-category-instructions-hint" className="text-sm text-muted-foreground">{tr("Spiega come preferisci dividere le spese. Questo testo viene inviato all’assistente quando è attivo: non inserire dati personali o bancari.")}</p>
      <Textarea id="ai-category-instructions" value={value} maxLength={2000} rows={4}
        aria-describedby="ai-category-instructions-hint" disabled={update.isPending}
        placeholder={tr("Per esempio: metti le consegne di pasti in Ristoranti & Bar e gli acquisti di libri in Svago.")}
        onChange={(event) => { setDraft(event.target.value); setSavedNotice(false); }} />
      <p className="text-xs text-muted-foreground">{value.length}{tr("/2000 · Le modifiche valgono per le nuove proposte. Dopo il salvataggio, premi «Categorizza con l’AI» per rigenerare quelle in attesa.")}</p>
      <Button type="submit" className="self-start" disabled={!dirty || update.isPending}>
        {update.isPending ? tr("Salvataggio…") : tr("Salva istruzioni")}
      </Button>
      {savedNotice && <p role="status" className="text-sm text-muted-foreground">{tr("Istruzioni salvate. Le categorie già assegnate restano invariate.")}</p>}
      {update.isError && <p role="alert" className="text-sm text-neg">{tr(update.error.message)}</p>}
    </form>
  );
}
