"use client";

/** Lombard: le linee di credito (credit Lombard, fido) con utilizzo, interessi, andamento e registro. */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { CreditLineDetail, CreditLinePortfolioCard, DebtsViewGate, useDebtsActions } from "@/components/domain/debts";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { buildInvestmentsView } from "@/lib/investments/view";
import { startOfDay } from "@/lib/calc/expenses";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import { useDebtsQuery } from "@/lib/queries/debts";
import { cn } from "@/lib/utils";

const EMPTY_TITLE = "Nessuna linea di credito";
const EMPTY_TEXT = "Aggiungi un credit Lombard o un fido: vedrai quanto ne usi, quanto ti costa ogni mese e quando scatta la tua soglia di allerta.";

function LombardContent() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { openAdd } = useDebtsActions();
  const query = useDebtsQuery();
  const data = query.data;
  const router = useRouter();
  const selectedId = useSearchParams().get("id");
  // Gli investimenti sono facoltativi: senza operazioni (o con un errore) la scheda di confronto non compare.
  const investmentsQuery = useInvestmentsOverviewQuery("1mese");
  const portfolioValue = React.useMemo(() => {
    if (!investmentsQuery.data || investmentsQuery.data.transactions.length === 0) return null;
    return buildInvestmentsView(investmentsQuery.data, "1mese", startOfDay(new Date())).summary.totalValue;
  }, [investmentsQuery.data]);
  const lines = data?.creditLines ?? [];
  const selected = lines.find((l) => l.id === selectedId) ?? lines[0];

  return (
    <DebtsViewGate loading={query.isLoading} error={query.isError} empty={false} onRetry={() => query.refetch()}>
      {selected ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/debiti" className="mr-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronLeftIcon size={16} aria-hidden="true" /> Debiti
            </Link>
            {lines.length > 1
              ? lines.map((l) => (
                  <Link key={l.id} href={`/debiti/lombard?id=${l.id}`} aria-current={l.id === selected.id ? "page" : undefined} className={cn("rounded-full border px-3 py-1 text-sm", l.id === selected.id ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}>
                    {l.name}
                  </Link>
                ))
              : null}
          </div>
          {portfolioValue !== null ? (
            <CreditLinePortfolioCard used={selected.plan.used} currentRate={selected.plan.currentRate} portfolioValue={portfolioValue} currency={currency} />
          ) : null}
          <CreditLineDetail key={selected.id} line={selected} currency={currency} onDeleted={() => router.push("/debiti")} />
        </>
      ) : (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="font-heading text-lg font-medium text-foreground">{EMPTY_TITLE}</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{EMPTY_TEXT}</p>
          <Button className="mt-4" onClick={openAdd}>
            Aggiungi una linea di credito
          </Button>
        </div>
      )}
    </DebtsViewGate>
  );
}

export default function LombardPage() {
  return (
    <React.Suspense fallback={null}>
      <LombardContent />
    </React.Suspense>
  );
}
