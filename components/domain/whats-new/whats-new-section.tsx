"use client";

import { useWhatsNew } from "@/lib/whats-new/use-whats-new";
import { WhatsNewCard } from "./whats-new-card";

/** Mostra la novità corrente, se c'è e non è stata chiusa; altrimenti non rende nulla. */
export function WhatsNewSection() {
  const { entry, dismiss } = useWhatsNew();
  return entry ? <WhatsNewCard entry={entry} onDismiss={dismiss} /> : null;
}
