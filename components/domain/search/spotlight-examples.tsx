"use client";

/**
 * «Prova a scrivere»: three sentences to try when «Cerca» opens empty, in the app language. They show at first sight
 * that the field searches and also turns a sentence into something to add; a tap writes the sentence in the field.
 */

import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

/** A setting that every account has, a movement and a trade: each one answers for any user, demo or real. */
const EXAMPLES: Record<string, readonly string[]> = {
  it: ["tema scuro", "speso 12 € al bar", "comprato 3 Apple a 50 € oggi"],
  en: ["dark theme", "spent €12 on coffee", "bought 3 Apple at 50 today"],
  de: ["dunkles Design", "12 € im Café bezahlt", "3 Apple zu 50 gekauft"],
};

export interface SpotlightExamplesProps {
  onPick: (sentence: string) => void;
  phone?: boolean;
  className?: string;
}

export function SpotlightExamples({ onPick, phone = false, className }: SpotlightExamplesProps) {
  const { t: tr, language } = useLocalization();
  const examples = EXAMPLES[language] ?? EXAMPLES.it;
  return (
    <section aria-label={tr("Prova a scrivere")} className={className}>
      <h3 className={cn("px-3 pb-2 font-medium text-text-3", phone ? "text-[13px]" : "text-xs")}>{tr("Prova a scrivere")}</h3>
      <div className="flex flex-wrap gap-2 px-2">
        {examples.map((sentence) => (
          <button
            key={sentence}
            type="button"
            onClick={() => onPick(sentence)}
            className={cn(
              "cursor-pointer rounded-full bg-foreground/[0.07] px-3.5 text-left transition-colors hover:bg-foreground/[0.12]",
              phone ? "min-h-11 py-2 text-[15px]" : "min-h-9 py-1.5 text-sm"
            )}
          >
            {sentence}
          </button>
        ))}
      </div>
    </section>
  );
}
