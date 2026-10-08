"use client";

import { useQuery } from "@tanstack/react-query";

export type PersonalImportListing = {
  formats: { id: string; name: string }[];
  jobs: { id: string; formatId: string; status: string; estimatedAt: string; expiresAt: string; createdAt: string; error: string | null; notifiedAt: string | null }[];
};

export const personalImportLabels: Record<string, string> = {
  queued: "In attesa di analisi", processing: "Stiamo analizzando il CSV",
  ready: "Pronto da verificare", review_failed: "Ci sono righe da verificare",
  failed: "Analisi non riuscita", imported: "Importato", expired: "File scaduto",
};

export function usePersonalImportsQuery() {
  return useQuery({
    queryKey: ["personal-imports"],
    queryFn: async (): Promise<PersonalImportListing> => {
      const response = await fetch("/api/personal-imports", { cache: "no-store" });
      if (!response.ok) throw new Error("Impossibile caricare i CSV personali. Riprova.");
      return response.json();
    },
    refetchInterval: 10000,
  });
}
