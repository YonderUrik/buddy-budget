"use client";
import { useId } from "react";
import { COUNTRY_LANGUAGES, LANGUAGE_NAMES, isSupportedProfile, type LocaleProfile, type ProductCountry, type Language } from "@/lib/localization/config";
import { useLocalization } from "@/lib/localization/provider";
/** Separate country and language selectors shared by onboarding and account preferences. */
export function LocaleFields({ value, onChange, disabled = false }: { value: LocaleProfile; onChange: (profile: LocaleProfile) => void; disabled?: boolean }) {
  const { t } = useLocalization();
  const id = useId();
  const inputClass = "mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm";
  return <fieldset disabled={disabled} className="grid gap-4 sm:grid-cols-2">
    <legend className="sr-only">{t("Regole del prodotto")}</legend>
    <label htmlFor={`${id}-country`} className="text-sm font-medium">{t("Paese del prodotto")}
      <select id={`${id}-country`} className={inputClass} value={value.productCountry} onChange={event => {
        const productCountry = event.target.value as ProductCountry;
        onChange({ productCountry, language: isSupportedProfile(productCountry, value.language) ? value.language : "en" });
      }}><option value="IT">{t("Italia")}</option><option value="DE">{t("Germania")}</option></select>
    </label>
    <label htmlFor={`${id}-language`} className="text-sm font-medium">{t("Lingua")}
      <select id={`${id}-language`} className={inputClass} value={value.language} onChange={event => onChange({ ...value, language: event.target.value as Language })}>
        {COUNTRY_LANGUAGES[value.productCountry].map(language => <option key={language} value={language}>{LANGUAGE_NAMES[language]}</option>)}
      </select>
    </label>
    <p className="text-sm text-muted-foreground sm:col-span-2">{t("Il paese determina le funzioni finanziarie disponibili. La lingua cambia solo i testi e i formati.")}</p>
    {value.productCountry === "DE" ? <p role="status" className="text-sm text-muted-foreground sm:col-span-2">{t("Per la Germania, tasse, pensione, previsioni dei dividendi e pianificazione del pensionamento non sono ancora disponibili. I dati esistenti vengono conservati.")}</p> : null}
  </fieldset>;
}
