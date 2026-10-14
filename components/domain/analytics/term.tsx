"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Parola o cifra sottolineata a puntini: al tocco (o con la tastiera) si apre un popup con la spiegazione breve. */

import type { ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { track } from "@/lib/analytics";
import { GLOSSARY, type GlossaryId } from "./glossary";

export interface TermProps {
  id: GlossaryId;
  children: ReactNode;
}

export function Term({ id, children }: TermProps) {
  const { t: tr } = useLocalization();
  const entry = GLOSSARY[id];
  return (
    <Popover onOpenChange={(open) => open && track("analytics_term_opened", { term: id })}>
      <PopoverTrigger
        className="cursor-help rounded-sm underline decoration-primary/60 decoration-dotted underline-offset-4 outline-none hover:decoration-primary focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={tr("{0}: cosa significa", {0: tr(entry.title)})}
      >
        {children}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)]">
        <p className="font-heading text-sm font-medium text-foreground">{tr(entry.title)}</p>
        <p className="text-xs leading-relaxed text-muted-foreground">{tr(entry.text)}</p>
      </PopoverContent>
    </Popover>
  );
}
