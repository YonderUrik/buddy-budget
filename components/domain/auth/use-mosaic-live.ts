"use client";

/**
 * Orologio del mosaico del login: dopo l'ingresso delle tessere fa arrivare un movimento alla volta (i primi
 * ravvicinati, poi a regime) e restituisce lo stato aggiornato. Con `enabled = false` (reduced motion) non parte:
 * mostra uno stato fermo con i primi movimenti già arrivati. Si ferma a scheda nascosta.
 */

import * as React from "react";
import { MOSAIC_TIMING, advanceMosaicLive, createMosaicLive, type MosaicLive } from "./login-mosaic.model";

const STATIC_STEPS = MOSAIC_TIMING.rapidTicks;

function delayFor(step: number): number {
  if (step === 0) return MOSAIC_TIMING.firstTickMs;
  return step < MOSAIC_TIMING.rapidTicks ? MOSAIC_TIMING.rapidTickMs : MOSAIC_TIMING.tickMs;
}

export function useMosaicLive(enabled: boolean): MosaicLive {
  const [live, setLive] = React.useState<MosaicLive>(createMosaicLive);

  const staticLive = React.useMemo(() => {
    let snapshot = createMosaicLive();
    for (let i = 0; i < STATIC_STEPS; i++) snapshot = advanceMosaicLive(snapshot);
    return snapshot;
  }, []);

  React.useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout>;
    let step = 0;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!document.hidden) setLive(advanceMosaicLive);
        step += 1;
        schedule();
      }, delayFor(step));
    };
    schedule();
    return () => clearTimeout(timer);
  }, [enabled]);

  return enabled ? live : staticLive;
}
