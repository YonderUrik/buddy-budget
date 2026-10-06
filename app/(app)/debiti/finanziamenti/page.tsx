"use client";

/** Un finanziamento: cifre, "E se…", piano, eventi e azioni. L'id arriva dall'elenco (?id=), senza id si apre il primo. */

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeftIcon } from "lucide-react";
import { DebtDetail, DebtsViewGate } from "@/components/domain/debts";
import { authClient } from "@/lib/auth/client";
import { useDebtsQuery } from "@/lib/queries/debts";
import { cn } from "@/lib/utils";

function FinanziamentiContent() {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const router = useRouter();
  const id = useSearchParams().get("id");
  const query = useDebtsQuery();
  const data = query.data;
  const selected = data?.debts.find((d) => d.id === id) ?? data?.debts[0];

  return (
    <DebtsViewGate loading={query.isLoading} error={query.isError} empty={data?.debts.length === 0} onRetry={() => query.refetch()}>
      {data && selected ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/debiti" className="mr-2 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
              <ChevronLeftIcon size={16} aria-hidden="true" /> Debiti
            </Link>
            {data.debts.length > 1
              ? data.debts.map((d) => (
                  <Link
                    key={d.id}
                    href={`/debiti/finanziamenti?id=${d.id}`}
                    aria-current={d.id === selected.id ? "page" : undefined}
                    className={cn("max-w-full truncate rounded-full border px-3 py-1 text-sm", d.id === selected.id ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:text-foreground")}
                  >
                    {d.name}
                  </Link>
                ))
              : null}
          </div>
          <DebtDetail key={selected.id} debt={selected} currency={currency} onDeleted={() => router.push("/debiti")} />
        </>
      ) : null}
    </DebtsViewGate>
  );
}

export default function FinanziamentiPage() {
  return (
    <React.Suspense fallback={null}>
      <FinanziamentiContent />
    </React.Suspense>
  );
}
