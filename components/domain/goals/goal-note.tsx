"use client";

/** Nota in linea con l'icona «i»: spiega un numero o una scelta senza riquadri. */

import type { ReactNode } from "react";
import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GoalNoteProps {
  children: ReactNode;
  className?: string;
}

export function GoalNote({ children, className }: GoalNoteProps) {
  return (
    <p className={cn("flex gap-2 text-sm text-text-2", className)}>
      <InfoIcon className="mt-0.5 size-4 shrink-0 text-text-3" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
