"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { GOALS_BASE_PATH } from "@/components/domain/analytics";
import { DeleteGoalDialog, GoalDetail, GoalFormDialog, useGoalFormatters, type GoalFormStep } from "@/components/domain/goals";
import { BackLink, EmptyState, LoadError } from "@/components/domain/shared";
import { TargetIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { useAchieveGoalMutation, useDeleteGoalMutation, useGoalsQuery, useUpdateGoalMutation } from "@/lib/queries/goals";

/** Dettaglio di un obiettivo: stato, fonti, cosa cambia quando lo raggiungi e le azioni (modifica, raggiunto, elimina). */
export default function ObiettivoPage() {
  const { t: tr } = useLocalization();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const query = useGoalsQuery();
  const update = useUpdateGoalMutation();
  const achieve = useAchieveGoalMutation();
  const remove = useDeleteGoalMutation();
  const fmt = useGoalFormatters(query.data?.currency ?? "EUR");
  const [editStep, setEditStep] = React.useState<GoalFormStep | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  if (query.isLoading) return <div className="h-96 animate-pulse rounded-2xl bg-foreground/[0.04]" aria-busy="true" />;
  if (query.isError || !query.data) return <LoadError message={tr("Impossibile caricare l'obiettivo.")} onRetry={() => query.refetch()} />;
  const view = query.data;
  const goal = view.goals.find((g) => g.id === id);
  if (!goal) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink href={GOALS_BASE_PATH} label={tr("Obiettivi")} />
        <EmptyState icon={TargetIcon} title={tr("Obiettivo non trovato")} description={tr("Forse è stato eliminato.")} primary={{ label: tr("Torna agli obiettivi"), href: GOALS_BASE_PATH }} />
      </div>
    );
  }
  const openEdit = (step: GoalFormStep) => {
    update.reset();
    setEditStep(step);
  };
  return (
    <div className="flex flex-col gap-4">
      <BackLink href={GOALS_BASE_PATH} label={tr("Obiettivi")} />
      <GoalDetail
        goal={goal}
        currency={view.currency}
        fmt={fmt}
        fireYear={view.fire?.withGoalsYear ?? null}
        onAddMoney={() => openEdit("fonti")}
        onEdit={() => openEdit("tipo")}
        onToggleAchieved={() => achieve.mutate({ id: goal.id, kind: goal.kind, achieved: !goal.achievedAt })}
        onDelete={() => {
          remove.reset();
          setConfirmDelete(true);
        }}
        pending={achieve.isPending}
      />
      <GoalFormDialog
        open={editStep !== null}
        onOpenChange={(open) => (open ? null : setEditStep(null))}
        view={view}
        todayKey={view.todayKey}
        fmt={fmt}
        goal={goal}
        startStep={editStep ?? "tipo"}
        pending={update.isPending}
        error={update.isError ? update.error.message : null}
        onSubmit={(payload) => update.mutate({ id: goal.id, kind: goal.kind, input: { ...payload, priority: undefined } }, { onSuccess: () => setEditStep(null) })}
      />
      <DeleteGoalDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        name={goal.name}
        pending={remove.isPending}
        error={remove.isError ? remove.error.message : null}
        onConfirm={() => remove.mutate({ id: goal.id, kind: goal.kind }, { onSuccess: () => router.push(GOALS_BASE_PATH) })}
      />
    </div>
  );
}
