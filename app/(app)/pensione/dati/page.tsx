"use client";

/** I tuoi dati: profilo del fondo e inserimento delle fotografie (contributi netti e controvalore). */

import { PensionProfileCard, PensionSnapshotsCard } from "@/components/domain/pension";
import { usePensionView } from "@/lib/pension/use-pension-view";

export default function PensioneDatiPage() {
  const { store, snapshots, today, currency } = usePensionView();
  return (
    <>
      <PensionSnapshotsCard snapshots={snapshots} currency={currency} today={today} onAdd={store.addSnapshot} onRemove={store.removeSnapshot} />
      <PensionProfileCard name={store.profile.name} adhesionDate={store.profile.adhesionDate} today={today} onChange={store.setProfile} />
      <div className="flex justify-end">
        <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={store.resetDemo}>Ripristina i dati d&apos;esempio</button>
      </div>
    </>
  );
}
