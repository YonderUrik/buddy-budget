"use client";

/** Sezione Preferenze: valuta, pagina iniziale, tema e lingua (quest'ultima non ancora disponibile). */

import * as React from "react";
import { useTheme } from "next-themes";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SegmentedControl } from "@/components/domain/shared";
import { HOME_PAGE_OPTIONS, type HomePagePath } from "@/lib/account/home-pages";
import { SUPPORTED_CURRENCIES, type SupportedCurrency } from "@/lib/validation/currency";
import { useUpdateUserSettingsMutation, type UserSettings } from "@/lib/queries/user-settings";
import { SettingsRow, SettingsSection } from "./settings-section";

type ThemeChoice = "light" | "dark" | "system";

const THEME_OPTIONS = [
  { value: "light", label: "Chiaro" },
  { value: "dark", label: "Scuro" },
  { value: "system", label: "Sistema" },
] as const satisfies readonly { value: ThemeChoice; label: string }[];

const currencyLabel = (value: string) => {
  const currency = SUPPORTED_CURRENCIES.find((c) => c.value === value);
  return currency ? `${currency.label} (${currency.symbol})` : value;
};
const homePageLabel = (value: string) => HOME_PAGE_OPTIONS.find((o) => o.path === value)?.label ?? value;

/** Store vuoto: distingue il render server (false) da quello client (true), il tema si conosce solo sul client. */
const subscribeNoop = () => () => {};

export interface PreferencesSectionProps {
  settings: UserSettings;
}

export function PreferencesSection({ settings }: PreferencesSectionProps) {
  const update = useUpdateUserSettingsMutation();
  const { theme, setTheme } = useTheme();
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);

  return (
    <SettingsSection id="impostazioni-preferenze" title="Preferenze">
      <SettingsRow
        label="Valuta"
        hint="Cambia solo come vengono mostrati gli importi: quelli già salvati non vengono convertiti."
      >
        <Select
          value={settings.currency}
          onValueChange={(value) => value && value !== settings.currency && update.mutate({ currency: value as SupportedCurrency })}
          disabled={update.isPending}
        >
          <SelectTrigger className="w-full sm:w-56" aria-label="Valuta">
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

      <SettingsRow label="Pagina iniziale" hint="Dove atterri dopo l'accesso.">
        <Select
          value={settings.homePage}
          onValueChange={(value) => value && value !== settings.homePage && update.mutate({ homePage: value as HomePagePath })}
          disabled={update.isPending}
        >
          <SelectTrigger className="w-full sm:w-56" aria-label="Pagina iniziale">
            <SelectValue>{(value: string | null) => (value ? homePageLabel(value) : "")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {HOME_PAGE_OPTIONS.map((option) => (
              <SelectItem key={option.path} value={option.path}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingsRow>

      <SettingsRow label="Tema" hint="Vale per questo dispositivo.">
        {mounted ? (
          <SegmentedControl
            options={THEME_OPTIONS}
            value={(theme as ThemeChoice | undefined) ?? "system"}
            onChange={setTheme}
            ariaLabel="Tema"
          />
        ) : (
          <div className="h-10 w-56" />
        )}
      </SettingsRow>

      <SettingsRow label="Lingua" hint="Presto potrai usare BuddyBudget anche in altre lingue.">
        <p className="text-sm text-muted-foreground">
          Italiano <span className="ml-1 rounded-full border border-border px-1.5 py-0.5 text-[10px]">Presto altre</span>
        </p>
      </SettingsRow>

      {update.isError && (
        <p className="text-sm text-neg" role="alert">
          {update.error.message}
        </p>
      )}
    </SettingsSection>
  );
}
