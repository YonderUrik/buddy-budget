"use client";

/** Guida iniziale di Analitiche: si apre da sola alla prima visita, si riapre dal pulsante «Guida». */

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { WALKTHROUGH_STEPS } from "./walkthrough-steps";

export interface WalkthroughDialogProps {
  open: boolean;
  /** `step` è l'ultimo passo visto (1-based). */
  onClose: (step: number, outcome: "completata" | "chiusa") => void;
}

export function WalkthroughDialog({ open, onClose }: WalkthroughDialogProps) {
  const [index, setIndex] = React.useState(0);
  const step = WALKTHROUGH_STEPS[index];
  const last = index === WALKTHROUGH_STEPS.length - 1;
  const close = (outcome: "completata" | "chiusa") => {
    onClose(index + 1, outcome);
    setIndex(0);
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close("chiusa")}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogDescription>
            Passo {index + 1} di {WALKTHROUGH_STEPS.length}
          </DialogDescription>
          <DialogTitle>{step.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm leading-relaxed text-muted-foreground">
          {step.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
        <DialogFooter className="items-center sm:justify-between">
          <div className="flex gap-1" aria-hidden="true">
            {WALKTHROUGH_STEPS.map((s, i) => (
              <span key={s.title} className={`size-1.5 rounded-full ${i === index ? "bg-primary" : "bg-muted-foreground/30"}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {index > 0 ? (
              <Button variant="outline" onClick={() => setIndex(index - 1)}>
                Indietro
              </Button>
            ) : (
              <Button variant="ghost" onClick={() => close("chiusa")}>
                Salta
              </Button>
            )}
            {last ? <Button onClick={() => close("completata")}>Inizia</Button> : <Button onClick={() => setIndex(index + 1)}>Avanti</Button>}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
