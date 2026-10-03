"use client";

/** I tuoi dati: inserimento delle fotografie (contributi netti e controvalore), profilo del fondo e altri fondi. */

import * as React from "react";
import { PensionAddFundForm, PensionImportDialog, PensionProfileCard, PensionSnapshotsCard } from "@/components/domain/pension";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePensionView } from "@/lib/pension/pension-context";
import { PENSION_MAX_FUNDS } from "@/lib/pension/limits";
import {
  useCreatePensionFundMutation,
  useDeletePensionFundMutation,
  useDeletePensionSnapshotMutation,
  useSavePensionSnapshotMutation,
  useUpdatePensionFundMutation,
} from "@/lib/queries/pension";

export default function PensioneDatiPage() {
  const { fund, funds, snapshots, today, currency, selectFund } = usePensionView();
  const [importOpen, setImportOpen] = React.useState(false);
  const saveSnapshot = useSavePensionSnapshotMutation();
  const deleteSnapshot = useDeletePensionSnapshotMutation();
  const updateFund = useUpdatePensionFundMutation();
  const deleteFund = useDeletePensionFundMutation();
  const createFund = useCreatePensionFundMutation();
  if (!fund) return null;

  return (
    <>
      <PensionSnapshotsCard
        snapshots={snapshots}
        currency={currency}
        today={today}
        onAdd={async (snapshot) => {
          await saveSnapshot.mutateAsync({ fundId: fund.id, input: snapshot, existing: snapshots.length });
        }}
        onRemove={(snapshotId) => deleteSnapshot.mutate({ fundId: fund.id, snapshotId })}
        onImport={() => setImportOpen(true)}
      />
      <PensionImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        fundId={fund.id}
        fundName={fund.name}
        existing={snapshots}
        currency={currency}
        today={today}
      />
      <PensionProfileCard
        key={fund.id}
        name={fund.name}
        adhesionDate={fund.adhesionDate}
        today={today}
        onSave={async (input) => {
          await updateFund.mutateAsync({ fundId: fund.id, input });
        }}
        onDelete={async () => {
          await deleteFund.mutateAsync(fund.id);
          selectFund(funds.find((f) => f.id !== fund.id)?.id ?? "");
        }}
      />
      {funds.length < PENSION_MAX_FUNDS ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hai un altro fondo?</CardTitle>
            <p className="text-sm text-muted-foreground">Puoi tracciarne più di uno (per esempio un fondo negoziale e un PIP): il patrimonio netto li somma.</p>
          </CardHeader>
          <CardContent>
            <PensionAddFundForm
              key={funds.length}
              today={today}
              pending={createFund.isPending}
              errorMessage={createFund.isError ? createFund.error.message : null}
              onSubmit={(input) => createFund.mutate(input, { onSuccess: (created) => selectFund(created.id) })}
            />
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
