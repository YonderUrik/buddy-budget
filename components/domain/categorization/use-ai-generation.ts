"use client";
import * as React from "react";
import { toast } from "sonner";
import { useLocalization } from "@/lib/localization/provider";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import { track } from "@/lib/analytics";
import { useGenerateAiSuggestionsMutation, useGenerationJobQuery } from "@/lib/queries/categorization";
import { useAiCategorizationQuery, useUpdateAiCategorizationMutation } from "@/lib/queries/notifications";

export interface UseAiGenerationOptions {
  groups: readonly SuggestionGroup[];
  refetch: () => Promise<unknown>;
}

/** Drive progress and completion from the server job, including blocked-only and failed runs. */
export function useAiGeneration({ groups, refetch }: UseAiGenerationOptions) {
  const { t: tr } = useLocalization();
  const { data: assistant } = useAiCategorizationQuery();
  const generateMutation = useGenerateAiSuggestionsMutation();
  const consentMutation = useUpdateAiCategorizationMutation();
  const jobQuery = useGenerationJobQuery(Boolean(assistant?.available));
  const job = jobQuery.data;
  const handled = React.useRef<string | null>(null);
  const [mountedAt] = React.useState(Date.now);
  const missingCount = groups.filter((group) => !group.suggestion).length;
  const generating = consentMutation.isPending || generateMutation.isPending || (job?.status === "running" && !jobQuery.isError);

  React.useEffect(() => {
    if (!job || job.status === "running" || handled.current === job.id) return;
    handled.current = job.id;
    void refetch();
    if (job.updatedAt < mountedAt) return;
    track("ai_suggestions_generate_finished", { outcome: job.status, stored: job.stored, blocked: job.blocked });
    if (job.status === "failed") toast.error(tr("L'assistente si è interrotto. Puoi riprovare."));
    else if (job.stored === 0) toast.info(tr("Nessuna nuova proposta. Puoi scegliere le categorie a mano."));
    else toast.success(tr("{0} esercenti hanno una proposta", { 0: job.stored }));
  }, [job, refetch, tr, mountedAt]);

  React.useEffect(() => {
    if (jobQuery.isError) toast.error(tr("Impossibile leggere lo stato dell'assistente"));
  }, [jobQuery.isError, tr]);

  const start = async () => {
    if (generating) return;
    track("ai_suggestions_generate_clicked", { missing: missingCount, consentGiven: Boolean(assistant?.enabled) });
    try {
      if (!assistant?.enabled) await consentMutation.mutateAsync(true);
      const result = await generateMutation.mutateAsync();
      if (result.status !== "started") throw new Error(tr("L'assistente non è disponibile"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : tr("Impossibile avviare l'assistente"));
    }
  };

  return {
    assistant, missingCount, generating,
    foundCount: job?.status === "done" ? job.stored : undefined,
    startMissing: job?.total ?? 0,
    done: job?.stored ?? 0,
    start,
  };
}
