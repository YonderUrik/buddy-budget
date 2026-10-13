"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Pannello d'azione legato a una riga (es. Dividi, Modifica): da `sm` in su si apre sotto la riga, sul telefono in un
 * foglio dal basso, così non serve scorrere la pagina per trovarlo. `children` riceve la forma scelta per adattare lo
 * sfondo (nel foglio il pannello non ha bisogno del proprio riquadro).
 */

import * as React from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useMediaQuery } from "@/lib/hooks/use-media-query";
import { SHEET_QUERY } from "@/lib/motion/sheet";

export type InlineOrSheetLayout = "inline" | "sheet";

export interface InlineOrSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Titolo del foglio: solo per i lettori di schermo, salvo `showTitle` (quando il pannello non ne ha uno suo). */
  title: string;
  showTitle?: boolean;
  children: (layout: InlineOrSheetLayout) => React.ReactNode;
}

export function InlineOrSheet({ open, onOpenChange, title, showTitle = false, children }: InlineOrSheetProps) {
  const { t: tr } = useLocalization();
  const sheet = useMediaQuery(SHEET_QUERY);
  if (!sheet) return open ? <>{children("inline")}</> : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-3">
        <DialogTitle className={showTitle ? undefined : "sr-only"}>{tr(title)}</DialogTitle>
        {children("sheet")}
      </DialogContent>
    </Dialog>
  );
}
