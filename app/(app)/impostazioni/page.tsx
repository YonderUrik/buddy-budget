"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Settings page: five groups (account, look and use, notifications and AI, privacy and data, danger zone). */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  DangerZoneSection,
  DataSection,
  AiCategorizationSection,
  NotificationsSection,
  PasswordSection,
  PreferencesSection,
  PrivacySection,
  ProfileSection,
  InstanceSection,
  SessionsSection,
  SettingsHub,
  SidebarSection,
  parseSettingsGroup,
  useRecentLogin,
  type SettingsGroupId,
} from "@/components/domain/settings";
import { LoadError, PAGE_TITLE } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { useUserSettingsQuery } from "@/lib/queries/user-settings";

/** Vecchi indirizzi con ancora (es. nelle email già inviate) → gruppo che oggi contiene quella sezione. */
const LEGACY_HASH_GROUPS: Record<string, SettingsGroupId> = {
  "#impostazioni-notifiche": "notifiche",
  "#impostazioni-assistente-categorie": "notifiche",
  "#impostazioni-privacy": "privacy",
  "#impostazioni-dati": "privacy",
  "#impostazioni-barra-laterale": "aspetto",
  "#impostazioni-preferenze": "aspetto",
  "#impostazioni-profilo": "account",
  "#impostazioni-sessioni": "account",
  "#impostazioni-zona-pericolosa": "pericolo",
};

function ImpostazioniContent() {
  const { t: tr } = useLocalization();
  const { data: settings, isLoading, isError, refetch } = useUserSettingsQuery();
  const recentLogin = useRecentLogin(settings?.recentLoginUntil);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selected = parseSettingsGroup(searchParams.get("sezione"));

  React.useEffect(() => {
    const group = LEGACY_HASH_GROUPS[window.location.hash];
    if (group && !selected) router.replace(`${pathname}?sezione=${group}${window.location.hash}`);
  }, [selected, pathname, router]);

  // Gruppo aperto dall'elenco in questa visita: «‹ Impostazioni» torna indietro nella cronologia invece di aggiungere
  // un'altra voce, così il tasto indietro del telefono non riapre il gruppo appena chiuso.
  const openedFromList = React.useRef(false);

  function select(id: SettingsGroupId | null) {
    if (id === null && openedFromList.current) {
      openedFromList.current = false;
      router.back();
      return;
    }
    openedFromList.current = id !== null && !selected;
    if (id) router.push(`${pathname}?sezione=${id}`, { scroll: true });
    else router.replace(pathname, { scroll: true });
    if (id) track("settings_group_opened", { group: id });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      {/* Su telefono, dentro un gruppo, in cima c'è «‹ Impostazioni»: il titolo della pagina lo ripeterebbe. */}
      <div className={selected ? "max-md:hidden" : undefined}>
        <h1 className={PAGE_TITLE}>{tr("Impostazioni")}</h1>
        <p className="text-sm text-muted-foreground">{tr("Il tuo profilo, le preferenze e il controllo sui tuoi dati.")}</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : isError || !settings ? (
        <LoadError message={tr("Impossibile caricare le impostazioni.")} onRetry={() => refetch()} />
      ) : (
        <SettingsHub
          selected={selected}
          onSelect={select}
          content={{
            account: (
              <>
                <ProfileSection settings={settings} />
                {!settings.instance?.localMode && <PasswordSection settings={settings} recentLogin={recentLogin} />}
                {!settings.instance?.localMode && <SessionsSection />}
                {settings.instance && <InstanceSection status={settings.instance} />}
              </>
            ),
            aspetto: (
              <>
                <PreferencesSection settings={settings} />
                <SidebarSection />
              </>
            ),
            notifiche: (
              <>
                {(!settings.instance?.localMode || settings.instance.notifications) && <NotificationsSection email={settings.email} />}
                <AiCategorizationSection />
              </>
            ),
            privacy: (
              <>
                <PrivacySection settings={settings} />
                <DataSection settings={settings} recentLogin={recentLogin} />
              </>
            ),
            pericolo: <DangerZoneSection settings={settings} recentLogin={recentLogin} />,
          }}
        />
      )}
    </div>
  );
}

export default function ImpostazioniPage() {
  return (
    <React.Suspense fallback={<div className="mx-auto h-64 max-w-5xl p-4 sm:p-6" aria-busy="true" />}>
      <ImpostazioniContent />
    </React.Suspense>
  );
}
