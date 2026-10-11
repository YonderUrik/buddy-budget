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

  return (
    <div className="ai-surface flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <SparklesIcon className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col gap-0.5">
          <p className="flex flex-wrap items-center gap-2 font-heading text-base font-medium text-foreground">
            Categorizza con l&apos;AI <Badge>Novità</Badge>
          </p>
          {generating ? (
            <TextShimmer className="text-sm">L&apos;AI sta leggendo i tuoi esercenti…</TextShimmer>
          ) : (
            <p className="text-sm text-muted-foreground">
              {foundCount !== undefined
                ? `Pronte ${foundCount} proposte: le trovi nelle carte. Decidi tu cosa applicare.`
                : `${missingCount} ${missingCount === 1 ? "esercente non ha" : "esercenti non hanno"} ancora una proposta. L'AI può suggerire una categoria per ognuno: le confermi tu.`}
            </p>
          )}
        </div>
      </div>
      <Button type="button" className="ai-button h-10 shrink-0 border-0" onClick={handleClick} disabled={generating}>
        <SparklesIcon /> {generating ? "Sto lavorando…" : "Categorizza con l'AI"}
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
