"use client";

/** Pagina Impostazioni: profilo, preferenze, barra laterale, sessioni attive, esportazione dei dati, privacy e zona pericolosa. */

import {
  DangerZoneSection,
  DataSection,
  PreferencesSection,
  PrivacySection,
  ProfileSection,
  SessionsSection,
  SidebarSection,
  useRecentLogin,
} from "@/components/domain/settings";
import { LoadError } from "@/components/domain/shared";
import { useUserSettingsQuery } from "@/lib/queries/user-settings";

export default function ImpostazioniPage() {
  const { data: settings, isLoading, isError, refetch } = useUserSettingsQuery();
  const recentLogin = useRecentLogin(settings?.recentLoginUntil);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Impostazioni</h1>
        <p className="text-sm text-muted-foreground">Il tuo profilo, le preferenze e il controllo sui tuoi dati.</p>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-5" aria-busy="true">
          <div className="h-48 animate-pulse rounded-xl bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : isError || !settings ? (
        <LoadError message="Impossibile caricare le impostazioni." onRetry={() => refetch()} />
      ) : (
        <>
          <ProfileSection settings={settings} />
          <PreferencesSection settings={settings} />
          <SidebarSection />
          <SessionsSection />
          <DataSection settings={settings} recentLogin={recentLogin} />
          <PrivacySection settings={settings} />
          <DangerZoneSection settings={settings} recentLogin={recentLogin} />
        </>
      )}
    </div>
  );
}
