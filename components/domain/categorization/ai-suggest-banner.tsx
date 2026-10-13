"use client";
import { useLocalization } from "@/lib/localization/provider";

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
  /** Solo il pulsante, senza riquadro: per le intestazioni strette (mobile). */
  compact?: boolean;
  /** Le proposte sicure si applicano da sole: lo dice la conferma del consenso. */
  autoApplyEnabled?: boolean;
}

export interface AiProgressStripProps {
  /** Proposte comparse finora. */
  done: number;
  /** Esercenti senza proposta quando si è partiti. */
  total: number;
}

/** Barra di avanzamento con i contatori veri (proposte comparse su esercenti da elaborare), sempre visibile mentre l'assistente lavora. */
export function AiProgressStrip({ done, total }: AiProgressStripProps) {
  const { t: tr } = useLocalization();
  const percent = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done} aria-label={tr("Avanzamento dell'assistente")}>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="ai-button h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${Math.max(percent, 4)}%` }} />
      </div>
      <p className="text-xs text-muted-foreground tabular-nums">
        <TextShimmer className="text-xs">{tr("Sto leggendo i tuoi esercenti…")}</TextShimmer>{" "}{done}{" "}{tr("proposte su")}{" "}{total}
      </p>
    </div>
  );
}

export function AiSuggestBanner({ missingCount, consentGiven, generating, foundCount, onGenerate, compact = false, autoApplyEnabled = false }: AiSuggestBannerProps) {
  const { t: tr } = useLocalization();
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

  const button = compact ? (
    <Button type="button" size="sm" className="ai-button h-9 shrink-0 border-0" onClick={handleClick} disabled={generating} aria-label={tr("Categorizza con l'AI")}>
      <SparklesIcon className={generating ? "animate-pulse" : undefined} />{" "}{generating ? tr("In corso") : tr("AI")}
    </Button>
  ) : (
    <Button type="button" size="sm" className="ai-button h-8 shrink-0 border-0" onClick={handleClick} disabled={generating}>
      <SparklesIcon className={generating ? "animate-pulse" : undefined} />{" "}{generating ? tr("In corso…") : tr("Categorizza con l'AI")}
    </Button>
  );

  return (
    <div className={compact ? "shrink-0" : "ai-surface flex items-center gap-3 rounded-xl px-3 py-2"}>
      {compact ? null : (
        <>
          <SparklesIcon className="size-4 shrink-0 text-primary" aria-hidden />
          <p className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 text-sm">
            <span className="font-medium text-foreground">{tr("AI")}</span>
            <Badge className="h-4 px-1.5 text-[0.65rem]">{tr("Novità")}</Badge>
            {generating ? (
              <TextShimmer className="text-xs">{tr("Sto leggendo i tuoi esercenti…")}</TextShimmer>
            ) : (
              <span className="truncate text-xs text-muted-foreground">{status}</span>
            )}
          </p>
        </>
      )}
      {button}

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attivare l&apos;assistente per le categorie?</DialogTitle>
            <DialogDescription>
              Inviamo a un servizio di intelligenza artificiale solo il nome pulito dell&apos;esercente (mai importi, date, IBAN, note o nomi di persone), insieme alle categorie e alle eventuali istruzioni personali, con richiesta di non conservare i dati.{" "}
              {autoApplyEnabled
                ? "Quando è quasi certa l'app mette la categoria da sola, e la ritrovi in «Messe dall'app», dove puoi cambiarla; le altre le scegli tu."
                : "Le proposte restano da confermare."}{" "}
              Puoi disattivarlo quando vuoi in Impostazioni.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>{tr("Annulla")}</Button>
            <Button
              type="button"
              className="ai-button border-0"
              onClick={() => {
                setConfirming(false);
                onGenerate();
              }}
            >
              <SparklesIcon />{" "}{tr("Attiva e categorizza con l'AI")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
