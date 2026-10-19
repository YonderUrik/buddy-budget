"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Check, ChevronDown, Globe } from "lucide-react";

import { Flag } from "@/components/domain/locale/flag";
import { COUNTRY_FLAGS } from "@/components/domain/locale/flags";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { track } from "@/lib/analytics";
import { LANGUAGE_NAMES, PRODUCT_COUNTRY_NAMES as COUNTRY_NAMES, type Language, type ProductCountry } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
import { PUBLIC_DEMO_PROFILES } from "@/lib/public-demo/config";
import { cn } from "@/lib/utils";

/** What choosing a country changes, so the same language under two countries reads as two different demos. */
const COUNTRY_HINTS: Record<ProductCountry, string> = { IT: "Con tasse e regole italiane", DE: "Con tasse e regole tedesche", OTHER: "Con le funzioni che non dipendono dalle regole di un paese" };
/** Path of the route that opens the demo of a country and language. */
const DEMO_PATH = "/demo";

/** Demo profiles grouped by country, in the order of `PUBLIC_DEMO_PROFILES`. */
const DEMO_GROUPS: readonly { country: ProductCountry; languages: Language[] }[] = PUBLIC_DEMO_PROFILES.reduce<{ country: ProductCountry; languages: Language[] }[]>(
  (groups, { productCountry, language }) => {
    const group = groups.find((candidate) => candidate.country === productCountry);
    if (group) group.languages.push(language);
    else groups.push({ country: productCountry, languages: [language] });
    return groups;
  },
  [],
);

export interface PublicDemoFooterProps {
  className?: string;
}

/**
 * Footer of the public demo: one menu (globe, «country · language») listing every demo, grouped by country (its tax
 * and planning rules) with each language written in itself, like the landing's language menu. Each pair is its own
 * sample account, so a choice opens that account on the same page instead of editing a setting.
 */
export function PublicDemoFooter({ className }: PublicDemoFooterProps) {
  const { t, language, productCountry } = useLocalization();
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const title = t("Scegli la demo");
  const current = `${t(COUNTRY_NAMES[productCountry])} · ${LANGUAGE_NAMES[language]}`;

  function openDemo(country: ProductCountry, next: Language) {
    setOpen(false);
    const changed = country !== productCountry ? "country" : "language";
    track("public_demo_profile_changed", { changed, language: next, country });
    const params = new URLSearchParams({ country, lang: next, next: pathname });
    window.location.assign(`${DEMO_PATH}?${params.toString()}`);
  }

  return (
    <footer className={cn("mx-auto flex w-full max-w-6xl justify-center px-4 pb-8 pt-4 text-sm text-muted-foreground sm:px-6", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          aria-label={`${title}: ${current}`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-3 outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9"
        >
          <Globe className="size-4" aria-hidden="true" />
          <span>{current}</span>
          <ChevronDown className="size-3.5" aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent side="top" align="center" className="w-72">
          <p className="px-3 pt-1 font-heading text-base font-medium text-foreground">{title}</p>
          <div className="flex flex-col gap-3 pt-2">
            {DEMO_GROUPS.map(({ country, languages }) => (
              <div key={country} role="radiogroup" aria-label={t(COUNTRY_NAMES[country])} className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2.5 px-3 pb-1">
                  <Flag code={COUNTRY_FLAGS[country]} size="sm" />
                  <span className="flex flex-col">
                    <span className="text-sm font-medium text-foreground">{t(COUNTRY_NAMES[country])}</span>
                    <span className="text-xs text-muted-foreground">{t(COUNTRY_HINTS[country])}</span>
                  </span>
                </div>
                {languages.map((option) => {
                  const selected = country === productCountry && option === language;
                  return (
                    <button
                      key={option}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      lang={option}
                      onClick={() => !selected && openDemo(country, option)}
                      className={cn(
                        "flex min-h-11 w-full items-center justify-between gap-3 rounded-lg pl-10 pr-3 text-left text-sm text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "bg-primary/10 font-medium" : "hover:bg-muted",
                      )}
                    >
                      {LANGUAGE_NAMES[option]}
                      {selected ? <Check className="size-4 shrink-0 text-primary" aria-hidden="true" /> : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </footer>
  );
}
