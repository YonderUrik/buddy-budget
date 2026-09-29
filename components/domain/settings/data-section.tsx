"use client";

/** Sezione "I tuoi dati": riepilogo di cosa c'è e download di tutto in uno ZIP (JSON completo + CSV per Excel). */

import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { useExportDataMutation, useUserDataSummaryQuery, type UserSettings } from "@/lib/queries/user-settings";
import { DataSummaryList } from "./data-summary-list";
import { ReauthPanel } from "./reauth-panel";
import { SettingsSection } from "./settings-section";

export interface DataSectionProps {
  settings: UserSettings;
  recentLogin: boolean;
}

export function DataSection({ settings, recentLogin }: DataSectionProps) {
  const { data: summary, isLoading, isError, refetch } = useUserDataSummaryQuery();
  const exportData = useExportDataMutation();
  const needsReauth = !recentLogin || (exportData.error?.reauthRequired ?? false);

  return (
    <SettingsSection
      id="impostazioni-dati"
      title="I tuoi dati"
      description="Puoi scaricare in qualsiasi momento tutto quello che hai inserito o importato."
    >
      {isLoading ? (
        <div className="h-28 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : isError || !summary ? (
        <LoadError message="Impossibile caricare il riepilogo dei dati." onRetry={() => refetch()} />
      ) : (
        <DataSummaryList summary={summary} />
      )}

      <p className="text-sm text-muted-foreground">
        L&apos;archivio ZIP contiene un file JSON con tutti i dati e una tabella CSV per transazioni, conti, categorie,
        budget, regole, investimenti e storico del patrimonio, da aprire con Excel.
      </p>

      {needsReauth ? (
        <ReauthPanel email={settings.email} googleLinked={settings.googleLinked} />
      ) : (
        <Button
          type="button"
          className="w-fit"
          onClick={() => exportData.mutate(undefined, { onSuccess: () => track("account_data_exported") })}
          disabled={exportData.isPending}
        >
          {exportData.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
          {exportData.isPending ? "Preparazione in corso…" : "Scarica i miei dati"}
        </Button>
      )}
      {exportData.isError && !exportData.error.reauthRequired && (
        <p className="text-sm text-neg" role="alert">
          {exportData.error.message}
        </p>
      )}
    </SettingsSection>
  );
}
