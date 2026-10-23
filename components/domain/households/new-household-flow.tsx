"use client";

/**
 * «Nuovo gruppo» in three steps: the name (with ready-made ones), what the creator shows the group (the app has
 * already ticked the usual choices), then the invitation. The group exists from step two, so the invitation can go
 * out by email or as a link; «Fatto» opens the group page.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StepActions, StepHeading, StepProgress, StepStage, useStepFlow } from "@/components/domain/shared";
import { HOUSEHOLD_NAME_MAX, HOUSEHOLD_NAME_SUGGESTIONS, looksLikeHouseholdAccount } from "@/lib/households/constants";
import type { ShareableAccount } from "@/lib/households/types";
import { useLocalization } from "@/lib/localization/provider";
import { useAccountsQuery } from "@/lib/queries/accounts";
import { useCreateHouseholdMutation, type SharingPayload } from "@/lib/queries/households";
import { cn } from "@/lib/utils";
import { InvitePanel } from "./invite-panel";
import { initialSharing, SharingChoices } from "./sharing-choices";

const STEPS = 3;

export interface NewHouseholdFlowProps {
  currency: string;
  /** Where «Fatto» goes; defaults to the new group's page. */
  doneHref?: (id: string) => string;
}

export function NewHouseholdFlow({ currency, doneHref = (id) => `/groups/${id}` }: NewHouseholdFlowProps) {
  const { t: tr } = useLocalization();
  const router = useRouter();
  const flow = useStepFlow(STEPS);
  const accountsQuery = useAccountsQuery();
  const accounts: ShareableAccount[] = React.useMemo(
    () =>
      (accountsQuery.data ?? [])
        .filter((a) => !a.isDemo)
        .map((a) => ({ id: a.id, name: a.name, icon: a.icon, color: a.color, balance: Number(a.balance), shared: false, suggested: looksLikeHouseholdAccount(a.name) })),
    [accountsQuery.data]
  );
  const [name, setName] = React.useState("");
  const [sharing, setSharing] = React.useState<SharingPayload | null>(null);
  const [createdId, setCreatedId] = React.useState<string | null>(null);
  const create = useCreateHouseholdMutation();
  const value = sharing ?? initialSharing(accounts);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (flow.index === 0) {
      if (name.trim()) flow.next();
      return;
    }
    if (flow.index === 1) {
      if (createdId) {
        flow.next();
        return;
      }
      const result = await create.mutateAsync({ name: name.trim(), sharing: value }).catch(() => null);
      if (!result) return;
      setCreatedId(result.id);
      flow.next();
      return;
    }
    if (createdId) router.push(doneHref(createdId));
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-7">
      <StepProgress index={flow.index} count={flow.count} label="Nuovo gruppo" />
      <StepStage stepKey={flow.index} direction={flow.direction}>
        {flow.index === 0 ? (
          <div className="flex flex-col gap-5">
            <StepHeading title="Come chiamate il gruppo?" description="Lo vede chi ne fa parte. Puoi stare in più gruppi: la coppia, la casa con i coinquilini, la famiglia." />
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={HOUSEHOLD_NAME_MAX}
              placeholder={tr("Per esempio: Noi due")}
              className="h-12 rounded-full px-5 text-base"
              aria-label={tr("Nome del gruppo")}
            />
            <div className="flex flex-wrap gap-2">
              {HOUSEHOLD_NAME_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setName(tr(suggestion))}
                  className={cn("h-10 rounded-full px-4 text-sm font-medium transition-colors", name === tr(suggestion) ? "bg-foreground text-background" : "bg-muted hover:bg-muted/70")}
                >
                  {tr(suggestion)}
                </button>
              ))}
            </div>
          </div>
        ) : flow.index === 1 ? (
          <div className="flex flex-col gap-4">
            <StepHeading title="Cosa fai vedere al gruppo?" description="Ho già messo le scelte più comuni: cambiale se vuoi. Il resto rimane tuo." />
            <SharingChoices accounts={accounts} value={value} onChange={setSharing} currency={currency} />
            {create.isError ? <p className="text-sm text-neg">{create.error.message}</p> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <StepHeading title="Chi inviti?" description="Chi accetta sceglie a sua volta cosa far vedere. Puoi invitare anche più tardi dalla pagina del gruppo." />
            {createdId ? <InvitePanel householdId={createdId} householdName={name.trim()} /> : null}
          </div>
        )}
      </StepStage>
      <StepActions
        backLabel={flow.index === 1 ? "Indietro" : undefined}
        onBack={flow.back}
        primaryLabel={flow.index === 0 ? "Avanti" : flow.index === 1 ? "Crea il gruppo" : "Fatto"}
        pending={create.isPending}
        disabled={flow.index === 0 && !name.trim()}
      />
    </form>
  );
}

/** Spare button to reach the flow from elsewhere (Settings, the empty state). */
export function NewHouseholdButton({ className }: { className?: string }) {
  const { t: tr } = useLocalization();
  const router = useRouter();
  return (
    <Button type="button" variant="sun" className={cn("h-11 rounded-full px-5", className)} onClick={() => router.push("/groups/new")}>
      {tr("Nuovo gruppo")}
    </Button>
  );
}
