"use client";

/** Pulsante «Chiudi» in alto a destra dei dialog a tutto schermo: sul telefono non c'è sfondo da toccare per uscire. */

import { XIcon } from "lucide-react";
import { DialogClose } from "@/components/ui/dialog";

export function DialogCloseButton({ label = "Chiudi" }: { label?: string }) {
  return (
    <DialogClose aria-label={label} className="absolute top-3 right-3 grid size-11 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:top-4 sm:right-4 sm:size-9">
      <XIcon className="size-5" aria-hidden="true" />
    </DialogClose>
  );
}
