"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { GoalFormDialog, GoalsEmpty, GoalsOverview, useGoalFormatters } from "@/components/domain/goals";
import { GOALS_BASE_PATH } from "@/components/domain/analytics";
import { LoadError } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { GOAL_KINDS, type GoalKind } from "@/lib/goals/constants";
import { useLocalization } from "@/lib/localization/provider";
import { useCreateGoalMutation, useGoalsQuery, useReorderGoalsMutation } from "@/lib/queries/goals";
import { useNotificationPreferencesQuery, useUpdateNotificationPreferencesMutation } from "@/lib/queries/notifications";

/** Parametro che apre il form «Nuovo obiettivo» (dalla testata, dalla Panoramica, dalle novità); `tipo` lo preimposta. */
const NEW_PARAM = "nuovo";
const KIND_PARAM = "tipo";
const FROM_PARAM = "da";
const OPEN_SOURCES = ["panoramica", "novita", "email"] as const;

/** Vista Obiettivi di Analitiche: piano del risparmio, lista per priorità e form per un obiettivo nuovo. */
export default function ObiettiviPage() {
  const { t: tr } = useLocalization();
  const router = useRouter();
  const params = useSearchParams();
  const query = useGoalsQuery();
  const create = useCreateGoalMutation();
  const reorder = useReorderGoalsMutation();
  const notifications = useNotificationPreferencesQuery();
  const updateNotifications = useUpdateNotificationPreferencesMutation();
  const fmt = useGoalFormatters(query.data?.currency ?? "EUR");
  const paramKind = params.get(KIND_PARAM);
  const [open, setOpen] = React.useState(false);
  const [presetKind, setPresetKind] = React.useState<GoalKind | null>(null);

  // Da dove si arriva (una volta per visita) e apertura del form chiesta dall'indirizzo.
  React.useEffect(() => {
    const from = params.get(FROM_PARAM);
    track("goals_opened", { from: OPEN_SOURCES.find((s) => s === from) ?? "analitiche" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'ingresso nella vista
  }, []);
  // Con `?nuovo=1` il form è aperto finché lo si chiude; chiudendolo il parametro sparisce dall'indirizzo.
  const requestedNew = params.has(NEW_PARAM);
  const dialogOpen = open || requestedNew;
  const kind = requestedNew ? (GOAL_KINDS.find((k) => k === paramKind) ?? null) : presetKind;
  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (!next && requestedNew) router.replace(GOALS_BASE_PATH, { scroll: false });
  };

  const openNew = (kind?: GoalKind) => {
    setPresetKind(kind ?? null);
    create.reset();
    setOpen(true);
  };

  if (query.isLoading) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-28 animate-pulse rounded-2xl bg-foreground/[0.04]" />
        <div className="h-72 animate-pulse rounded-2xl bg-foreground/[0.04]" />
      </div>
    );
  }
  if (query.isError || !query.data) return <LoadError message={tr("Impossibile caricare gli obiettivi.")} onRetry={() => query.refetch()} />;
  const view = query.data;
  return (
    <>
      {view.goals.length === 0 ? (
        <GoalsEmpty view={view} fmt={fmt} onNew={openNew} />
      ) : (
        <GoalsOverview view={view} fmt={fmt} hrefFor={(id) => `${GOALS_BASE_PATH}/${id}`} onReorder={(ids) => reorder.mutate(ids)} reordering={reorder.isPending} />
      )}
      <GoalFormDialog
        open={dialogOpen}
        onOpenChange={changeOpen}
        view={view}
        todayKey={view.todayKey}
        fmt={fmt}
        presetKind={kind}
        offerReminders={notifications.data ? !notifications.data.goalAlertsEnabled : false}
        onEnableReminders={() =>
          updateNotifications.mutate({ goalAlertsEnabled: true }, { onSuccess: () => track("notifications_toggled", { kind: "goals", enabled: true }) })
        }
        pending={create.isPending}
        error={create.isError ? create.error.message : null}
        onSubmit={(payload) => create.mutate(payload, { onSuccess: () => changeOpen(false) })}
      />
    </>
  );
}
