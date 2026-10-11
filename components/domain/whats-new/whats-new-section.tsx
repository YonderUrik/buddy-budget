"use client";

import { useWhatsNew } from "@/lib/whats-new/use-whats-new";
import { WhatsNewChip } from "./whats-new-chip";

/** Etichetta della novità corrente, se c'è e non è stata chiusa; altrimenti non rende nulla. */
export function WhatsNewSection() {
  const { entry, dismiss } = useWhatsNew();
  return entry ? <WhatsNewChip entry={entry} onDismiss={dismiss} /> : null;
}
