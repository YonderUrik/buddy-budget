"use client";
import { useId } from "react";

import { Flag, COUNTRY_FLAGS, LanguageSelect } from "@/components/domain/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_LANGUAGES, PRODUCT_COUNTRIES, isSupportedProfile, type LocaleProfile, type ProductCountry, type Language } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { SettingsRow } from "./settings-section";

const COUNTRY_NAMES: Record<ProductCountry, string> = { IT: "Italia", DE: "Germania" };

export interface LocaleFieldsProps {
  value: LocaleProfile;
  onChange: (profile: LocaleProfile) => void;
  disabled?: boolean;
  /** Draw a line above the first row too (when the fields follow other settings rows). */
  divided?: boolean;
  /** Currency of the amount previewed under each language. */
  currency?: string;
}

/** Country and language rows shared by onboarding and account preferences: country with a flag, language opening the list with previews. */
export function LocaleFields({ value, onChange, disabled = false, divided = false, currency }: LocaleFieldsProps) {
  const { t } = useLocalization();
  const id = useId();
  const countryOf = (language: Language) => PRODUCT_COUNTRIES.find(country => COUNTRY_LANGUAGES[country].includes(language));
  return <fieldset disabled={disabled} className="flex flex-col gap-4">
    <legend className="sr-only">{t("Regole del prodotto")}</legend>
    <SettingsRow label={t("Paese")} hint={t("Decide tasse e funzioni disponibili.")} htmlFor={`${id}-country`} className={cn(divided && "first:border-t first:pt-4")}>
      <Select value={value.productCountry} disabled={disabled} onValueChange={next => {
        if (!next || next === value.productCountry) return;
        const productCountry = next as ProductCountry;
        onChange({ productCountry, language: isSupportedProfile(productCountry, value.language) ? value.language : "en" });
      }}>
        <SelectTrigger id={`${id}-country`} className="h-10 w-full sm:w-56" aria-label={t("Paese")}>
          <SelectValue>{(country: string | null) => country ? <><Flag code={COUNTRY_FLAGS[country as ProductCountry]} />{t(COUNTRY_NAMES[country as ProductCountry])}</> : ""}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {PRODUCT_COUNTRIES.map(country => <SelectItem key={country} value={country}><Flag code={COUNTRY_FLAGS[country]} />{t(COUNTRY_NAMES[country])}</SelectItem>)}
        </SelectContent>
      </Select>
    </SettingsRow>
    <SettingsRow label={t("Lingua")} hint={t("Cambia solo testi, date e numeri.")} htmlFor={`${id}-language`}>
      <LanguageSelect
        id={`${id}-language`}
        value={value.language}
        disabled={disabled}
        currency={currency}
        available={COUNTRY_LANGUAGES[value.productCountry]}
        unavailableHint={language => { const country = countryOf(language); return country ? t("Disponibile col paese {0}", { 0: t(COUNTRY_NAMES[country]) }) : ""; }}
        onChange={language => onChange({ ...value, language })}
      />
    </SettingsRow>
    {value.productCountry === "DE" ? <p role="status" className="text-sm text-muted-foreground">{t("Per la Germania, tasse, pensione, previsioni dei dividendi e pianificazione del pensionamento non sono ancora disponibili. I dati esistenti vengono conservati.")}</p> : null}
  </fieldset>;
}
