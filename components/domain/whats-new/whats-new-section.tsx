"use client";

import { useWhatsNew } from "@/lib/whats-new/use-whats-new";
import { WhatsNewChip } from "./whats-new-chip";
import { WhatsNewLine } from "./whats-new-line";

/** Novità corrente nella forma scelta, se c'è e non è stata chiusa; altrimenti non rende nulla. */
export function WhatsNewSection({ variant }: { variant: "chip" | "line" }) {
  const { entry, dismiss } = useWhatsNew();
  if (!entry) return null;
  return variant === "chip" ? <WhatsNewChip entry={entry} onDismiss={dismiss} /> : <WhatsNewLine entry={entry} onDismiss={dismiss} />;
}
