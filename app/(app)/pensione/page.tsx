"use client";

/**
 * Pensione (prototipo): fotografie del fondo inserite a mano → rendimento, stima del netto, confronto col TFR in
 * azienda e proiezione. I dati vivono nel browser finché il prototipo non viene portato su DB.
 */

import * as React from "react";
import {
  PensionChartCard,
  PensionProfileCard,
  PensionProjectionCard,
  PensionSnapshotsCard,
  PensionSummaryCard,
  PensionTfrCompareCard,
  PensionWithdrawalCard,
} from "@/components/domain/pension";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { companyTfrValue, computePensionPerformance, deriveContributions, recentQuarterlyContribution, sortSnapshots, withdrawalScenarios } from "@/lib/calc/pension";
import { todayIso } from "@/lib/debts/dates";
import { usePensionPrototype } from "@/lib/pension/use-pension-prototype";

/** Inflazione annua costante usata per la rivalutazione del TFR in azienda (con i dati veri verrà dall'indice). */
const ASSUMED_INFLATION = 0.02;

export default function PensionePage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const store = usePensionPrototype();
  const today = todayIso();
  const sorted = React.useMemo(() => sortSnapshots(store.snapshots), [store.snapshots]);
  const adhesion = store.profile.adhesionDate || null;
  const performance = React.useMemo(() => computePensionPerformance(sorted, adhesion), [sorted, adhesion]);
  const contributions = React.useMemo(() => deriveContributions(sorted, adhesion), [sorted, adhesion]);
  const last = sorted.at(-1);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div>
        <h1 className="font-heading text-2xl font-medium text-foreground">Pensione</h1>
        <p className="text-sm text-muted-foreground">Il tuo fondo pensione: quanto rende, quanto ti resterebbe e dove arriverà</p>
      </div>

      {store.isDemo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
          <p className="text-sm text-foreground">Stai guardando <strong className="font-medium">dati d&apos;esempio</strong>. Prova a cambiarli o inserisci i tuoi.</p>
          <Button size="sm" variant="outline" onClick={store.startEmpty}>Inserisci i miei dati</Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" onClick={store.resetDemo}>Ripristina i dati d&apos;esempio</Button>
        </div>
      )}

      {performance && last ? (
        <>
          <PensionSummaryCard name={store.profile.name} performance={performance} currency={currency} />
          <PensionChartCard snapshots={sorted} currency={currency} />
        </>
      ) : null}

      <PensionSnapshotsCard snapshots={sorted} currency={currency} today={today} onAdd={store.addSnapshot} onRemove={store.removeSnapshot} />

      {performance && last ? (
        <>
          <PensionWithdrawalCard scenarios={withdrawalScenarios(last.value, last.netContributions, adhesion, today)} adhesionDate={adhesion} currency={currency} />
          <PensionTfrCompareCard fundValue={last.value} comparison={companyTfrValue(contributions, last.date, ASSUMED_INFLATION)} inflationRate={ASSUMED_INFLATION} currency={currency} />
          <PensionProjectionCard startValue={last.value} defaultQuarterlyContribution={recentQuarterlyContribution(sorted) ?? 0} currency={currency} />
        </>
      ) : null}

      <PensionProfileCard name={store.profile.name} adhesionDate={store.profile.adhesionDate} today={today} onChange={store.setProfile} />

      <p className="text-xs text-muted-foreground">Stime a scopo informativo, non consulenza finanziaria o fiscale: regole e aliquote vanno verificate con un professionista.</p>
    </div>
  );
}
