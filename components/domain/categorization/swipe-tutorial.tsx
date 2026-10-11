"use client";

/**
 * Spiegazione di come funzionano le carte, mostrata la prima volta e riapribile con «?». Il fatto di averla vista
 * si ricorda solo su questo dispositivo (localStorage): se non è disponibile, torna a comparire e basta.
 */

import * as React from "react";
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, CircleHelpIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Chiave in cui si ricorda che la spiegazione è già stata vista. */
export const SWIPE_TUTORIAL_STORAGE_KEY = "bb:categorize-tutorial-seen";

interface TutorialRow {
  icon: React.ReactNode;
  gesture: string;
  keys: string;
  meaning: string;
}

const ROWS: readonly TutorialRow[] = [
  { icon: <ArrowRightIcon className="size-4 text-pos" />, gesture: "Trascina a destra", keys: "→ o Invio", meaning: "La categoria proposta è giusta: conferma." },
  { icon: <ArrowLeftIcon className="size-4 text-neg" />, gesture: "Trascina a sinistra", keys: "←", meaning: "È un'altra categoria: scegli quella giusta." },
  { icon: <ArrowDownIcon className="size-4 text-muted-foreground" />, gesture: "Trascina in alto", keys: "↓", meaning: "Salta per ora: la carta va in fondo al mazzo." },
];

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SWIPE_TUTORIAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.localStorage.setItem(SWIPE_TUTORIAL_STORAGE_KEY, "1");
  } catch {
    // Senza localStorage la spiegazione comparirà ancora: nessun danno.
  }
}

export function SwipeTutorial() {
  const [open, setOpen] = React.useState(false);

  // Si apre da sola solo alla prima volta: il valore arriva dal browser, quindi dopo il montaggio.
  React.useEffect(() => {
    const timer = setTimeout(() => setOpen(!readSeen()), 0);
    return () => clearTimeout(timer);
  }, []);

  function close() {
    writeSeen();
    setOpen(false);
  }

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label="Come funziona" className="mx-auto">
        <CircleHelpIcon /> Come funziona
      </Button>
      <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorizza una carta alla volta</DialogTitle>
            <DialogDescription>Ogni carta è un esercente, con la categoria che l&apos;assistente propone. Decidi tu: nulla si applica da solo.</DialogDescription>
          </DialogHeader>
          <ul className="flex flex-col gap-3">
            {ROWS.map((row) => (
              <li key={row.gesture} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">{row.icon}</span>
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">
                    {row.gesture} <span className="hidden font-normal text-muted-foreground sm:inline">({row.keys})</span>
                  </span>
                  <span className="text-muted-foreground">{row.meaning}</span>
                </span>
              </li>
            ))}
          </ul>
          <ul className="flex flex-col gap-1.5 text-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">Annulla</span> (Z): riporta indietro l&apos;ultima carta, finché non è stata salvata (qualche secondo).
            </li>
            <li>
              <span className="font-medium text-foreground">Ricorda per questo esercente</span>: crea una regola, solo se la spunti.
            </li>
          </ul>
          <DialogFooter>
            <Button type="button" onClick={close}>Ho capito</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
