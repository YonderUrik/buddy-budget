"use client";

/**
 * Azioni su un obiettivo (modifica, aggiorna i soldi da parte, segna come raggiunto, elimina) con i loro dialog:
 * le usano la lista degli Obiettivi (menu «⋯» di ogni riga) e il dettaglio, così il comportamento è uno solo.
 */

import * as React from "react";
import type { GoalsView, GoalView } from "@/lib/goals/view";
import { useAchieveGoalMutation, useDeleteGoalMutation, useUpdateGoalMutation } from "@/lib/queries/goals";
import { DeleteGoalDialog } from "./delete-goal-dialog";
import type { GoalFormatters } from "./goal-format";
import { GoalFormDialog } from "./goal-form-dialog";
import type { GoalFormStep } from "./goal-form-state";

/** Cosa si può fare su un obiettivo da un menu o da un pulsante. */
export type GoalAction = "edit" | "addMoney" | "toggleAchieved" | "delete";

/** Stato e dialog delle azioni su un obiettivo; `run` avvia un'azione, `dialogs` va montato una volta nella pagina. */
export function useGoalActions(input: { view: GoalsView | undefined; fmt: GoalFormatters; onDeleted?: () => void }) {
  const { view, fmt, onDeleted } = input;
  const update = useUpdateGoalMutation();
  const achieve = useAchieveGoalMutation();
  const remove = useDeleteGoalMutation();
  const [edit, setEdit] = React.useState<{ id: string; step: GoalFormStep } | null>(null);
  const [deleting, setDeleting] = React.useState<string | null>(null);

  const run = (goal: GoalView, action: GoalAction) => {
    if (action === "toggleAchieved") {
      achieve.mutate({ id: goal.id, kind: goal.kind, achieved: !goal.achievedAt });
      return;
    }
    if (action === "delete") {
      remove.reset();
      setDeleting(goal.id);
      return;
    }
    update.reset();
    setEdit({ id: goal.id, step: action === "addMoney" ? "fonti" : "tipo" });
  };

  const editing = edit && view ? view.goals.find((g) => g.id === edit.id) : undefined;
  const toDelete = deleting && view ? view.goals.find((g) => g.id === deleting) : undefined;
  const dialogs = view ? (
    <>
      {editing ? (
        <GoalFormDialog
          open
          onOpenChange={(open) => (open ? null : setEdit(null))}
          view={view}
          todayKey={view.todayKey}
          fmt={fmt}
          goal={editing}
          startStep={edit?.step ?? "tipo"}
          pending={update.isPending}
          error={update.isError ? update.error.message : null}
          onSubmit={(payload) => update.mutate({ id: editing.id, kind: editing.kind, input: { ...payload, priority: undefined } }, { onSuccess: () => setEdit(null) })}
        />
      ) : null}
      <DeleteGoalDialog
        open={toDelete !== undefined}
        onOpenChange={(open) => (open ? null : setDeleting(null))}
        name={toDelete?.name ?? ""}
        pending={remove.isPending}
        error={remove.isError ? remove.error.message : null}
        onConfirm={() =>
          toDelete
            ? remove.mutate(
                { id: toDelete.id, kind: toDelete.kind },
                {
                  onSuccess: () => {
                    setDeleting(null);
                    onDeleted?.();
                  },
                },
              )
            : undefined
        }
      />
    </>
  ) : null;

  return { run, dialogs, achievePending: achieve.isPending };
}
