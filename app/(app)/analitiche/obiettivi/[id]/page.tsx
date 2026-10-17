"use client";

import { useParams, useRouter } from "next/navigation";
import { GOALS_BASE_PATH } from "@/components/domain/analytics";
import { GoalDetail, useGoalActions, useGoalFormatters } from "@/components/domain/goals";
import { EmptyState, LoadError } from "@/components/domain/shared";
import { TargetIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { useGoalsQuery } from "@/lib/queries/goals";

/** Dettaglio di un obiettivo: stato, fonti, cosa cambia quando lo raggiungi e le azioni (modifica, raggiunto, elimina). */
export default function ObiettivoPage() {
  const { t: tr } = useLocalization();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = useGoalsQuery();
  const fmt = useGoalFormatters(query.data?.currency ?? "EUR");
  const actions = useGoalActions({ view: query.data, fmt, onDeleted: () => router.push(GOALS_BASE_PATH) });

  if (query.isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-foreground/[0.04]" aria-busy="true" />;
  if (query.isError || !query.data) return <LoadError message={tr("Impossibile caricare l'obiettivo.")} onRetry={() => query.refetch()} />;
  const view = query.data;
  const goal = view.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <div className="flex flex-col gap-4">
        <EmptyState icon={TargetIcon} title={tr("Obiettivo non trovato")} description={tr("Forse è stato eliminato.")} primary={{ label: tr("Torna agli obiettivi"), href: GOALS_BASE_PATH }} />
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <GoalDetail
        goal={goal}
        currency={view.currency}
        fmt={fmt}
        fireYear={view.fire?.withGoalsYear ?? null}
        onAddMoney={() => actions.run(goal, "addMoney")}
        onEdit={() => actions.run(goal, "edit")}
        onToggleAchieved={() => actions.run(goal, "toggleAchieved")}
        onDelete={() => actions.run(goal, "delete")}
        pending={actions.achievePending}
      />
      {actions.dialogs}
    </div>
  );
}
