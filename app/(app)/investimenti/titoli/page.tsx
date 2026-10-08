"use client";

/**
 * Scheda Titoli di Investimenti: i titoli posseduti e quelli che si seguono senza possederli (watchlist), con un
 * bottone per aggiungerne altri. Ogni titolo apre la sua pagina di analisi.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, PlusIcon } from "lucide-react";
import { InstrumentPicker, TitleListCard } from "@/components/domain/investments";
import { LoadError } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { INVESTMENTS_DEFAULT_PERIOD } from "@/lib/investments/labels";
import { useInvestmentsOverviewQuery } from "@/lib/queries/investments";
import { useTitleListQuery, useWatchMutation } from "@/lib/queries/titles";

export default function TitoliPage() {
  const router = useRouter();
  const list = useTitleListQuery();
  const overview = useInvestmentsOverviewQuery(INVESTMENTS_DEFAULT_PERIOD);
  const watch = useWatchMutation();
  const [addOpen, setAddOpen] = React.useState(false);
  const currency = overview.data?.currency ?? "EUR";

  const items = list.data?.items ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Quello che possiedi e quello che segui. Apri un titolo per vedere grafico, numeri chiave e impostare avvisi di prezzo.
        </p>
        <Button variant="outline" className="shrink-0 gap-1.5" onClick={() => setAddOpen(true)}>
          <PlusIcon size={15} aria-hidden="true" /> Aggiungi
        </Button>
      </div>

      {list.isLoading ? (
        <div className="h-48 animate-pulse rounded-xl bg-muted" aria-busy="true" />
      ) : list.isError ? (
        <LoadError message="Impossibile caricare i titoli." onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed">
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <EyeIcon size={28} className="text-muted-foreground" aria-hidden="true" />
            <p className="max-w-sm text-sm text-muted-foreground">
              Non segui ancora nessun titolo. Cerca un ETF, un&apos;azione o una crypto per vederne l&apos;andamento e ricevere un avviso quando arriva a un prezzo.
            </p>
            <Button onClick={() => setAddOpen(true)}>Cerca un titolo</Button>
          </div>
        </div>
      ) : (
        <TitleListCard items={items} />
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Segui un titolo</DialogTitle>
            <DialogDescription>Cerca per nome, ticker o ISIN: lo aggiungo alla tua lista e apro la sua pagina.</DialogDescription>
          </DialogHeader>
          <InstrumentPicker
            value={null}
            defaultCurrency={currency}
            onChange={(instrument) => {
              watch.mutate(
                { instrumentId: instrument.id, watch: true },
                {
                  onSuccess: () => {
                    setAddOpen(false);
                    router.push(`/investimenti/titoli/${instrument.id}`);
                  },
                }
              );
            }}
          />
          {watch.isError ? (
            <p role="alert" className="text-sm text-destructive">
              {watch.error.message}
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
