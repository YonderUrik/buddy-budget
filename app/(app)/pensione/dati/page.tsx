"use client";

/** I tuoi dati: inserimento delle fotografie (contributi netti e controvalore), profilo del fondo e altri fondi. */

import * as React from "react";
import { PlusCircleIcon } from "lucide-react";
import { PensionAddFundForm, PensionImportDialog, PensionProfileCard, PensionSection, PensionSnapshotsCard } from "@/components/domain/pension";
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
    <div className="flex flex-col gap-10">
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
        <PensionSection icon={PlusCircleIcon} title="Hai un altro fondo?" color="var(--swatch-indigo)" description="Puoi tracciarne più di uno (per esempio un fondo negoziale e un PIP): il patrimonio netto li somma.">
          <PensionAddFundForm
            key={funds.length}
            today={today}
            pending={createFund.isPending}
            errorMessage={createFund.isError ? createFund.error.message : null}
            onSubmit={(input) => createFund.mutate(input, { onSuccess: (created) => selectFund(created.id) })}
          />
        </PensionSection>
      ) : null}
    </div>
  );
}
