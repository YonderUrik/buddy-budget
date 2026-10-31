"use client";

import { useQuery } from "@tanstack/react-query";
import { hasRunningImport } from "@/lib/personal-import/island";
import { pageText } from "@/lib/localization/page-text";
import type { ImportCounts } from "@/lib/personal-import/counts";
import type { AnalysisProgress } from "@/lib/personal-import/progress";

export type PersonalImportListing = {
  formats: { id: string; name: string }[];
  jobs: { id: string; formatId: string; status: string; estimatedAt: string; expiresAt: string; createdAt: string; error: string | null; notifiedAt: string | null; progress?: AnalysisProgress | null; results: ({ cash: number; investments: number; skipped: number; bankCategorized: number; native?: { name: string; inserted: number } } & Partial<ImportCounts>) | null }[];
};

export const personalImportLabels: Record<string, string> = {
  queued: "In attesa di analisi", processing: "Stiamo analizzando il CSV",
  ready: "Salvataggio in corso",
  failed: "Analisi non riuscita", imported: "Importato", expired: "File scaduto",
};

export const PERSONAL_IMPORT_POLL_INTERVAL_MS = 3000;

export function usePersonalImportsQuery() {
  return useQuery({
    queryKey: ["personal-imports"],
    queryFn: async (): Promise<PersonalImportListing> => {
      const response = await fetch("/api/personal-imports", { cache: "no-store" });
      if (!response.ok) throw new Error(pageText("Impossibile caricare i CSV personali. Riprova."));
      return response.json();
    },
    // Interroga il server solo mentre c'è un'importazione in corso.
    refetchInterval: (query) => (hasRunningImport(query.state.data?.jobs) ? PERSONAL_IMPORT_POLL_INTERVAL_MS : false),
  });
}
