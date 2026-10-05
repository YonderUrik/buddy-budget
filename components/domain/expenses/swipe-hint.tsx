"use client";

/** Suggerimento (solo mobile) che spiega lo swipe sulle righe; sparisce con "Ho capito" e non torna più su questo dispositivo. */

import * as React from "react";
import { MoveHorizontalIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "bb:movimenti-swipe-hint";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Lo suggerimento è già stato chiuso? Senza localStorage (privato, bloccato) lo si mostra a ogni visita. */
function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function SwipeHint() {
  // Sul server (e in idratazione) si considera chiuso, così non c'è uno scarto tra HTML e client.
  const dismissed = React.useSyncExternalStore(subscribe, readDismissed, () => true);
  if (dismissed) return null;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // Il suggerimento tornerà alla prossima visita: nessun danno.
    }
    listeners.forEach((listener) => listener());
  }

  return (
    <div className="flex items-center gap-3 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground sm:hidden">
      <MoveHorizontalIcon className="size-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">
        Scorri una riga: a sinistra <strong className="text-foreground">Dividi</strong>, a destra{" "}
        <strong className="text-foreground">Categoria</strong>. Tocca per il dettaglio.
      </p>
      <Button type="button" variant="ghost" size="sm" className="h-9" onClick={dismiss}>
        Ho capito
      </Button>
    </div>
  );
}
