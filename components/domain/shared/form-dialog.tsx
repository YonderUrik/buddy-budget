"use client";

/**
 * Contenitore standard dei dialog con un form: a tutto schermo sul telefono (tastiera e liste hanno spazio), centrato
 * da `sm` in su con larghezza fissa, pulsante «Chiudi» sempre presente in alto a destra e scorrimento interno.
 * `size="wide"` solo per i dialog con tabelle o anteprime (import).
 */

import * as React from "react";
import { XIcon } from "lucide-react";
import { DialogClose, DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type FormDialogSize = "default" | "wide";

const BASE_CLASS =
  "flex max-h-dvh flex-col gap-5 overflow-y-auto sm:max-h-[90dvh] [&_[data-slot=dialog-header]]:pr-10";

const SIZE_CLASS: Record<FormDialogSize, string> = {
  default: "sm:max-w-lg",
  wide: "sm:max-w-2xl",
};

export interface FormDialogContentProps extends React.ComponentProps<typeof DialogContent> {
  size?: FormDialogSize;
  /** Etichetta accessibile del pulsante di chiusura. */
  closeLabel?: string;
}

/** `DialogContent` con il formato comune dei form (vedi sopra). Va dentro un `Dialog`, al posto di `DialogContent`. */
export function FormDialogContent({ size = "default", closeLabel = "Chiudi", className, children, ...props }: FormDialogContentProps) {
  return (
    <DialogContent mobileLayout="fullscreen" className={cn(BASE_CLASS, SIZE_CLASS[size], className)} {...props}>
      <DialogClose
        aria-label={closeLabel}
        className="absolute top-3 right-3 z-10 grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:top-4 sm:right-4 sm:size-9"
      >
        <XIcon className="size-5" aria-hidden="true" />
      </DialogClose>
      {children}
    </DialogContent>
  );
}
