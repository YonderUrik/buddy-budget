import type { InstallmentStatus } from "@/lib/calc/debt-plan";

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  pagata: "Pagata",
  da_pagare: "Da pagare",
  scaduta: "Scaduta",
  da_confermare: "Da confermare",
};

/** Classi (solo token del tema) del distintivo di stato di una rata. */
export const INSTALLMENT_STATUS_CLASS: Record<InstallmentStatus, string> = {
  pagata: "bg-pos-soft text-pos",
  da_pagare: "bg-muted text-muted-foreground",
  scaduta: "bg-neg-soft text-neg",
  da_confermare: "bg-muted text-foreground ring-1 ring-border",
};

export const START_MODE_LABELS = {
  nuovo: "Nuovo",
  origine: "In corso · dall'origine",
  fotografia: "In corso · fotografia di oggi",
} as const;
