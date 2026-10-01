"use client";

/** Simulatore: confronti "e se" su finanziamenti e linee di credito. Non scrive nulla (tranne la registrazione esplicita di un'estinzione già fatta). */

import {
  DebtsViewGate,
  SimulatorCreditRateCard,
  SimulatorEarlyCard,
  SimulatorPayoffCard,
  SimulatorRefinanceCard,
} from "@/components/domain/debts";
import { authClient } from "@/lib/auth/client";
import { useDebtsQuery } from "@/lib/queries/debts";

export default function SimulatorePage() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const query = useDebtsQuery();
  const loans = (query.data?.debts ?? []).filter((d) => !d.plan.totals.finished);
  const lines = query.data?.creditLines ?? [];

  return (
    <DebtsViewGate loading={query.isLoading} error={query.isError} empty={!query.data || (query.data.debts.length === 0 && lines.length === 0)} onRetry={() => query.refetch()}>
      {loans.length > 0 ? (
        <>
          <SimulatorEarlyCard loans={loans} currency={currency} />
          <SimulatorRefinanceCard loans={loans} currency={currency} />
          <SimulatorPayoffCard loans={loans} currency={currency} />
        </>
      ) : null}
      <SimulatorCreditRateCard lines={lines} currency={currency} />
      {loans.length === 0 && !lines.some((l) => l.plan.used > 0) ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Non c&apos;è nulla da simulare: tutti i finanziamenti sono chiusi e le linee di credito non sono usate.
        </p>
      ) : null}
    </DebtsViewGate>
  );
}
