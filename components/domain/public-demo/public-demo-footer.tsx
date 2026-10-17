"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import { Flag } from "@/components/domain/locale/flag";
import { COUNTRY_FLAGS } from "@/components/domain/locale/flags";
import { LanguageSelect } from "@/components/domain/locale/language-select";
import { track } from "@/lib/analytics";
import { COUNTRY_LANGUAGES, PRODUCT_COUNTRIES, profileForLanguage, type Language, type ProductCountry } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";

/** Country names, Italian source keys translated by the catalog. */
const COUNTRY_NAMES: Record<ProductCountry, string> = { IT: "Italia", DE: "Germania" };
/** Path of the route that opens the demo of a country and language. */
const DEMO_PATH = "/demo";

export interface PublicDemoFooterProps {
  className?: string;
}

/**
 * Footer of the public demo: chooses the country (its tax and planning rules) and the language of the demo. Each pair
 * is its own sample account, so a change opens that account on the same page instead of editing a setting.
 */
export function PublicDemoFooter({ className }: PublicDemoFooterProps) {
  const { t, language, productCountry } = useLocalization();
  const pathname = usePathname();

  function openDemo(country: ProductCountry, next: Language, changed: "country" | "language") {
    track("public_demo_profile_changed", { changed, language: next, country });
    const params = new URLSearchParams({ country, lang: next, next: pathname });
    window.location.assign(`${DEMO_PATH}?${params.toString()}`);
  }

  return (
    <footer className={cn("mx-auto flex w-full max-w-6xl flex-wrap items-center justify-center gap-x-6 gap-y-3 px-4 pb-8 pt-4 text-sm text-muted-foreground sm:px-6", className)}>
      <div role="radiogroup" aria-label={t("Paese")} className="flex items-center gap-1">
        {PRODUCT_COUNTRIES.map((country) => {
          const selected = country === productCountry;
          return (
            <button
              key={country}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                if (selected) return;
                const languages = COUNTRY_LANGUAGES[country];
                openDemo(country, languages.includes(language) ? language : languages[0], "country");
              }}
              className={cn(
                "inline-flex min-h-11 items-center gap-1.5 rounded-md px-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-9",
                selected ? "bg-primary/10 font-medium text-foreground" : "hover:text-foreground",
              )}
            >
              <Flag code={COUNTRY_FLAGS[country]} size="sm" />
              {t(COUNTRY_NAMES[country])}
            </button>
          );
        })}
      </div>
      <LanguageSelect
        variant="link"
        value={language}
        available={COUNTRY_LANGUAGES[productCountry]}
        unavailableHint={(other) => t("Disponibile col paese {0}", { 0: t(COUNTRY_NAMES[profileForLanguage(other).productCountry]) })}
        className="min-h-11 px-1 sm:min-h-9"
        onChange={(next) => openDemo(productCountry, next, "language")}
      />
    </footer>
  );
}
