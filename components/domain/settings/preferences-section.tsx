"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Sezione Preferenze: valuta, pagina iniziale, tema, statistiche d'uso anonime e paese del prodotto e lingua. */

import { LocaleFields } from "./locale-fields";
import { track } from "@/lib/analytics";
import * as React from "react";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/domain/shared";
import { HOME_PAGE_OPTIONS, type HomePagePath } from "@/lib/account/home-pages";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/validation/currency";
import { useUpdateUserSettingsMutation, type UserSettings } from "@/lib/queries/user-settings";
import { SlidersHorizontal } from "lucide-react";
import { SettingsRow, SettingsSection } from "./settings-section";

type ThemeChoice = "light" | "dark" | "system";

const THEME_OPTIONS = [
  { value: "light", label: "Chiaro" },
  { value: "dark", label: "Scuro" },
  { value: "system", label: "Sistema" },
] as const satisfies readonly { value: ThemeChoice; label: string }[];

/** Store vuoto: distingue il render server (false) da quello client (true), il tema si conosce solo sul client. */
const subscribeNoop = () => () => {};

export interface PreferencesSectionProps {
  settings: UserSettings;
}

export function PreferencesSection({ settings }: PreferencesSectionProps) {
  const { t: tr } = useLocalization();
  const currencyLabel = (value: string) => { const currency = SUPPORTED_CURRENCIES.find(c => c.value === value); return currency ? `${tr(currency.label)} (${currency.symbol})` : value; };
  const homePageLabel = (value: string) => tr(HOME_PAGE_OPTIONS.find(o => o.path === value)?.label ?? value);
  const update = useUpdateUserSettingsMutation();
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);

  return (
    <SettingsSection id="impostazioni-preferenze" title={tr("Preferenze")} icon={SlidersHorizontal}>
      <SettingsRow
        label={tr("Valuta")}
        hint={tr("Cambia solo come vengono mostrati gli importi: quelli già salvati non vengono convertiti.")}
      >
        <Select
          value={settings.currency}
          onValueChange={(value) => value && value !== settings.currency && update.mutate({ currency: value as SupportedCurrency })}
          disabled={update.isPending}
        >
          <SelectTrigger className="w-full sm:w-56" aria-label={tr("Valuta")}>
            <SelectValue>{(value: string | null) => (value ? currencyLabel(value) : "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_CURRENCIES.map((currency) => (
              <SelectItem key={currency.value} value={currency.value}>
                {currencyLabel(currency.value)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsRow label={tr("Pagina iniziale")} hint={tr("Dove atterri dopo l'accesso.")}>
        <Select
          value={settings.homePage}
          onValueChange={(value) => value && value !== settings.homePage && update.mutate({ homePage: value as HomePagePath })}
          disabled={update.isPending}
        >
          <SelectTrigger className="w-full sm:w-56" aria-label={tr("Pagina iniziale")}>
            <SelectValue>{(value: string | null) => (value ? homePageLabel(value) : "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HOME_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option.path} value={option.path}>
                {tr(option.label)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsRow label={tr("Tema")} hint={tr("Vale per questo dispositivo.")}>
        {mounted ? (
          <SegmentedControl
            options={THEME_OPTIONS}
            value={(theme as ThemeChoice | undefined) ?? "system"}
            onChange={setTheme}
            ariaLabel={tr("Tema")}
          />
        ) : (
          <div className="h-10 w-56" />
        )}
      </SettingsRow>


      <LocaleFields
        value={{ productCountry: settings.productCountry, language: settings.language }}
        currency={settings.currency}
        divided
        disabled={update.isPending}
        onChange={profile => {
          if (profile.language !== settings.language) track("language_changed", { from: "settings", language: profile.language });
          if (profile.productCountry !== settings.productCountry) track("country_changed", { from: "settings", country: profile.productCountry });
          update.mutate(profile);
        }}
      />

      {update.isError && (
        <p className="text-sm text-neg" role="alert">
          {tr(update.error.message)}
        </p>
      )}
    </SettingsSection>
  );
}
