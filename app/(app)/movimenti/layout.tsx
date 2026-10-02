"use client";

/**
 * Layout di Movimenti: titolo, periodo (un solo selettore per tutte le schede), "Aggiungi" e schede
 * Elenco / Analisi / Categorie. Nelle schede Categorie e Regole periodo e "Aggiungi" non compaiono e la pagina si allarga per la board.
 */

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import {
  AddTransactionForm,
  ExpensesPeriodSelector,
  ExpensesReferenceNav,
} from "@/components/domain/expenses";
import { MOVEMENTS_ACCOUNT_PARAM, MOVEMENTS_CATEGORIES_HREF, MOVEMENTS_MANAGEMENT_HREFS, MOVEMENTS_TABS, MovementsProvider, useMovements } from "@/components/domain/movements";
import { SectionTabs } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth/client";
import { useMarkMovementsSeen } from "@/lib/queries/attention";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { cn } from "@/lib/utils";

function MovementsHeader({ showPeriod }: { showPeriod: boolean }) {
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const { data: categories } = useCategoriesQuery();
  const { period, setPeriod, referenceDate, setReferenceDate } = useMovements();
  const [addOpen, setAddOpen] = React.useState(false);

  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-medium text-foreground">Movimenti</h1>
        {showPeriod ? (
          <ExpensesReferenceNav
            period={period}
            referenceDate={referenceDate}
            onChange={setReferenceDate}
            onPeriodChange={setPeriod}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Categorie e regole con cui si ordinano i tuoi movimenti</p>
        )}
      </div>
      {showPeriod && (
        <div className="flex shrink-0 items-center gap-2">
          <ExpensesPeriodSelector value={period} onChange={setPeriod} className="hidden sm:inline-flex" />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger
              render={
                <Button className="gap-1.5 shadow-xs">
                  <Plus size={15} aria-hidden="true" /> Aggiungi
                </Button>
              }
            />
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Nuova transazione</DialogTitle>
              </DialogHeader>
              <AddTransactionForm categories={categories ?? []} currency={currency} stacked onSuccess={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      )}
    </div>
  );
}

function MovementsFrame({ children }: { children: React.ReactNode }) {
  useMarkMovementsSeen();
  const pathname = usePathname();
  const accountParam = useSearchParams().get(MOVEMENTS_ACCOUNT_PARAM);
  const isCategories = pathname.startsWith(MOVEMENTS_CATEGORIES_HREF);
  const isManagement = MOVEMENTS_MANAGEMENT_HREFS.some((href) => pathname.startsWith(href));

  return (
    <MovementsProvider initialAccountId={accountParam}>
      <div className={cn("mx-auto flex flex-col gap-5 p-4 sm:gap-6 sm:p-6", isCategories ? "max-w-6xl" : "max-w-4xl")}>
        <div className="flex flex-col gap-3">
          <MovementsHeader showPeriod={!isManagement} />
          <SectionTabs tabs={MOVEMENTS_TABS} activeHref={pathname} ariaLabel="Sezioni di Movimenti" />
        </div>
        {children}
      </div>
    </MovementsProvider>
  );
}

export default function MovimentiLayout({ children }: { children: React.ReactNode }) {
  // useSearchParams richiede un confine Suspense.
  return (
    <React.Suspense fallback={null}>
      <MovementsFrame>{children}</MovementsFrame>
    </React.Suspense>
  );
}
