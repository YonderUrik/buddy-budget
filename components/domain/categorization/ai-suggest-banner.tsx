"use client";

/**
 * Invito a far proporre all'assistente (AI) una categoria per i movimenti già presenti. Se il consenso non c'è ancora,
 * il pulsante apre una conferma che spiega cosa viene inviato; mentre lavora mostra un testo che luccica.
 */

import * as React from "react";
import { SparklesIcon } from "lucide-react";
import { TextShimmer } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface AiSuggestBannerProps {
  /** Esercenti senza proposta in questo momento. */
  missingCount: number;
  /** L'utente ha già dato il consenso all'assistente. */
  consentGiven: boolean;
  /** L'assistente sta lavorando. */
  generating: boolean;
  /** Esito dell'ultima richiesta: quante proposte sono comparse (assente prima di una richiesta). */
  foundCount?: number;
  /** Avvia la generazione; se il consenso manca, il chiamante lo registra prima. */
  onGenerate: () => void;
}

export function AiSuggestBanner({ missingCount, consentGiven, generating, foundCount, onGenerate }: AiSuggestBannerProps) {
  const [confirming, setConfirming] = React.useState(false);

  function handleClick() {
    if (consentGiven) onGenerate();
    else setConfirming(true);
  }

  const status = generating
    ? null
    : foundCount !== undefined
      ? `${foundCount} proposte pronte nelle carte`
      : `${missingCount} ${missingCount === 1 ? "esercente senza" : "esercenti senza"} proposta`;

  return (
    <div className="ai-surface flex items-center gap-3 rounded-xl px-3 py-2">
      <SparklesIcon className="size-4 shrink-0 text-primary" aria-hidden />
      <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm">
        <span className="font-medium text-foreground">AI</span>
        <Badge className="h-4 px-1.5 text-[0.65rem]">Novità</Badge>
        {generating ? (
          <TextShimmer className="text-xs">Sto leggendo i tuoi esercenti…</TextShimmer>
        ) : (
          <span className="truncate text-xs text-muted-foreground">{status}</span>
        )}
      </p>
      <Button type="button" size="sm" className="ai-button h-8 shrink-0 border-0" onClick={handleClick} disabled={generating}>
        <SparklesIcon /> {generating ? "In corso…" : "Categorizza con l'AI"}
      </Button>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attivare l&apos;assistente per le categorie?</DialogTitle>
            <DialogDescription>
              Inviamo a un servizio di intelligenza artificiale solo il nome pulito dell&apos;esercente (mai importi, date, IBAN, note o nomi di persone), con richiesta di non conservare i dati. Le proposte non si applicano da sole. Puoi disattivarlo quando vuoi in Impostazioni.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>Annulla</Button>
            <Button
              type="button"
              className="ai-button border-0"
              onClick={() => {
                setConfirming(false);
                onGenerate();
              }}
            >
              <SparklesIcon /> Attiva e categorizza con l&apos;AI
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
