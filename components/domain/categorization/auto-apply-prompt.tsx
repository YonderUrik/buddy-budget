/**
 * Invito, in Categorizza, ad accendere «Applica da sole le categorie sicure» quando è spento (chi aveva dato il consenso
 * all'AI prima della soglia parte da spento). Una riga sola: cosa cambia e il pulsante.
 */

import { WandSparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confidencePercent } from "@/lib/categorization/origin";
import { AUTO_APPLY_THRESHOLD } from "@/lib/categorization/suggest";
import { cn } from "@/lib/utils";

export interface AutoApplyPromptProps {
  onEnable: () => void;
  pending?: boolean;
  className?: string;
}

export function AutoApplyPrompt({ onEnable, pending = false, className }: AutoApplyPromptProps) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl bg-foreground/[0.04] px-3 py-2", className)}>
      <WandSparklesIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Categorie sicure da sole</span> · Le proposte almeno al{" "}
        {confidencePercent(AUTO_APPLY_THRESHOLD)}% si applicano senza chiederti nulla e le ritrovi in «Fatte da sole».
      </p>
      <Button type="button" size="sm" onClick={onEnable} disabled={pending} className="h-9 shrink-0 sm:h-8">
        Attiva
      </Button>
    </div>
  );
}
