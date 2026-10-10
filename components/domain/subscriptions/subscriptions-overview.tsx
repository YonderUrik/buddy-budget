"use client";

/**
 * Schermata «Abbonamenti» (Liquidità): cifra al mese e all'anno, poi — nello stile della Panoramica — i rilevati da
 * confermare, gli abbonamenti confermati, quelli che non vedi più addebitare, gli aumenti di prezzo e l'archivio.
 */

import * as React from "react";
import { BellRingIcon, CheckIcon, MoonStarIcon, PlusIcon, RepeatIcon, SearchCheckIcon, TrendingUpIcon, XIcon } from "lucide-react";
import { MoneyHero } from "@/components/domain/net-worth";
import { SectionTitle, SoftRow } from "@/components/domain/liquidity";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { useCategoriesQuery } from "@/lib/queries/categories";
import { useSaveSubscriptionMutation } from "@/lib/queries/subscriptions";
import type { SubscriptionsResponse } from "@/lib/subscriptions/data";
import { recentPriceRises, upcomingCharges, type SubscriptionItem } from "@/lib/subscriptions/view";
import { AddSubscriptionDialog } from "./add-subscription-dialog";
import { SubscriptionDetailDialog } from "./subscription-detail-dialog";
import { SubscriptionRow } from "./subscription-row";
import { fromDate, whenPhrase } from "./subscriptions-format";

export interface SubscriptionsOverviewProps {
  data: SubscriptionsResponse;
  /** Notifica l'apertura del dettaglio (per l'evento di prodotto). */
  onItemOpened?: (item: SubscriptionItem) => void;
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

function Hero({ data }: { data: SubscriptionsResponse }) {
  const { totals, currency, today, items } = data;
  const upcoming = upcomingCharges(items, today);
  const next = upcoming[0];
  const upcomingTotal = upcoming.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  return (
    <section aria-label="Totale degli abbonamenti">
      <p className="text-base text-text-2">Gli abbonamenti ti costano ogni mese</p>
      <MoneyHero value={totals.monthly} currency={currency} className="text-5xl leading-none tracking-tight sm:text-7xl" />
      <p className="mt-3 text-sm text-text-2">
        {totals.count > 0 ? (
          <>
            <span className="font-mono font-semibold tabular-nums text-foreground">{formatCurrency(totals.yearly, currency, { maximumFractionDigits: 0 })}</span> all&apos;anno, in {totals.count}{" "}
            {plural(totals.count, "abbonamento confermato", "abbonamenti confermati")}.
          </>
        ) : (
          "Conferma quelli che riconosci qui sotto e li sommiamo."
        )}
        {totals.pendingCount > 0 ? (
          <>
            {" "}
            Altri {totals.pendingCount} da confermare valgono circa{" "}
            <span className="font-mono font-semibold tabular-nums text-foreground">{formatCurrency(totals.pendingMonthly, currency, { maximumFractionDigits: 0 })}</span> al mese.
          </>
        ) : null}
      </p>
      {next && next.nextDate ? (
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
          <BellRingIcon className="size-4 text-primary" aria-hidden="true" />
          <span>
            Prossimo addebito: <strong className="font-semibold">{next.name}</strong> {whenPhrase(today, next.nextDate)}
          </span>
          {upcoming.length > 1 ? (
            <span className="text-text-2">
              · nei prossimi 30 giorni {upcoming.length} addebiti, {formatCurrency(upcomingTotal, currency, { maximumFractionDigits: 0 })}
            </span>
          ) : null}
        </p>
      ) : null}
    </section>
  );
}

function ArchiveList({ title, items, ...rowProps }: { title: string; items: SubscriptionItem[]; currency: string; today: string; onOpen: (item: SubscriptionItem) => void }) {
  if (items.length === 0) return null;
  return (
    <details className="group rounded-2xl">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-semibold text-text-2 marker:hidden focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="transition-transform group-open:rotate-90" aria-hidden="true">›</span>
        {title} ({items.length})
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        {items.map((item) => (
          <SubscriptionRow key={item.key} item={item} {...rowProps} />
        ))}
      </div>
    </details>
  );
}

export function SubscriptionsOverview({ data, onItemOpened }: SubscriptionsOverviewProps) {
  const { items, currency, today } = data;
  const { data: categories } = useCategoriesQuery();
  const save = useSaveSubscriptionMutation();
  const [opened, setOpened] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const open = (item: SubscriptionItem) => {
    setOpened(item.key);
    onItemOpened?.(item);
  };
  const current = items.find((i) => i.key === opened) ?? null;

  const toConfirm = items.filter((i) => i.decision === "da-confermare" && i.activity === "attivo");
  const confirmed = items.filter((i) => i.decision === "confermato" && i.activity === "attivo");
  const stopped = items.filter((i) => i.activity === "fermo" && (i.decision === "confermato" || i.decision === "da-confermare"));
  const rises = recentPriceRises(items, today);
  const ended = items.filter((i) => i.decision === "terminato");
  const excluded = items.filter((i) => i.decision === "escluso");
  const rowProps = { currency, today, onOpen: open };

  function quick(item: SubscriptionItem, status: "confermato" | "escluso" | "terminato") {
    if (item.amount === null || item.cadence === null) return open(item);
    save.mutate({ origin: "rilevato", key: item.key, status, name: item.name, amount: item.amount, cadence: item.cadence, categoryId: item.categoryId });
  }

  const empty = items.length === 0;
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <Hero data={data} />

      {empty ? (
        <section className="rounded-2xl bg-foreground/[0.04] p-5">
          <SectionTitle icon={SearchCheckIcon} title="Ancora nessun abbonamento" color="var(--swatch-teal)" />
          <p className="text-sm text-text-2">
            Cerchiamo nei tuoi movimenti gli addebiti che tornano con lo stesso importo, ogni settimana, mese, trimestre o anno. Servono almeno tre mesi di movimenti (due anni, per quelli annuali).
            Se ne hai uno che non compare, aggiungilo a mano.
          </p>
        </section>
      ) : null}

      {toConfirm.length > 0 ? (
        <section aria-label="Da confermare">
          <SectionTitle icon={SearchCheckIcon} title="Trovati nei tuoi movimenti" color="var(--swatch-teal)" />
          <p className="mb-3 text-sm text-text-2">Addebiti che tornano con regolarità. Conferma quelli che sono davvero abbonamenti: una spesa ricorrente non lo è per forza.</p>
          <div className="flex flex-col gap-2">
            {toConfirm.map((item) => (
              <SubscriptionRow
                key={item.key}
                item={item}
                {...rowProps}
                actions={
                  <>
                    <Button type="button" size="sm" disabled={save.isPending} onClick={() => quick(item, "confermato")} className="h-11 gap-1.5 sm:h-8">
                      <CheckIcon className="size-4" aria-hidden="true" /> È un abbonamento
                    </Button>
                    <Button type="button" size="sm" variant="outline" disabled={save.isPending} onClick={() => quick(item, "escluso")} className="h-11 gap-1.5 sm:h-8">
                      <XIcon className="size-4" aria-hidden="true" /> Non lo è
                    </Button>
                  </>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      <section aria-label="I tuoi abbonamenti">
        <SectionTitle icon={RepeatIcon} title="I tuoi abbonamenti" color="var(--swatch-purple)" />
        {confirmed.length > 0 ? (
          <div className="flex flex-col gap-2">
            {confirmed.map((item) => (
              <SubscriptionRow key={item.key} item={item} {...rowProps} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-2">Nessun abbonamento confermato.</p>
        )}
        <Button type="button" variant="outline" onClick={() => setAdding(true)} className="mt-3 h-11 gap-1.5 sm:h-8">
          <PlusIcon className="size-4" aria-hidden="true" /> Aggiungi a mano
        </Button>
      </section>

      {stopped.length > 0 ? (
        <section aria-label="Non addebitati da un po'">
          <SectionTitle icon={MoonStarIcon} title="Non addebitati da un po'" color="var(--swatch-amber)" />
          <p className="mb-3 text-sm text-text-2">Dovevano tornare e non li vediamo più: sono terminati, o te ne sei dimenticato? Se non sono terminati, controlla che il conto sia sincronizzato.</p>
          <div className="flex flex-col gap-2">
            {stopped.map((item) => (
              <SubscriptionRow
                key={item.key}
                item={item}
                {...rowProps}
                actions={
                  <Button type="button" size="sm" variant="outline" disabled={save.isPending} onClick={() => quick(item, "terminato")} className="h-11 sm:h-8">
                    È terminato
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      ) : null}

      {rises.length > 0 ? (
        <section aria-label="Aumenti di prezzo">
          <SectionTitle icon={TrendingUpIcon} title="Aumenti di prezzo" color="var(--swatch-red)" />
          <div className="flex flex-col gap-2">
            {rises.map((item) => (
              <SoftRow
                key={item.key}
                title={item.name}
                hint={`Da ${formatCurrency(item.priceChange!.from, currency)} a ${formatCurrency(item.priceChange!.to, currency)} ${fromDate(item.priceChange!.since)}`}
                end={<span className="font-mono text-sm font-semibold tabular-nums text-neg">+{formatCurrency(item.priceChange!.to - item.priceChange!.from, currency)}</span>}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-1">
        <ArchiveList title="Terminati" items={ended} {...rowProps} />
        <ArchiveList title="Non sono abbonamenti" items={excluded} {...rowProps} />
      </div>

      <SubscriptionDetailDialog item={current} currency={currency} today={today} categories={categories ?? []} onOpenChange={(next) => !next && setOpened(null)} />
      <AddSubscriptionDialog open={adding} onOpenChange={setAdding} categories={categories ?? []} today={today} />
    </div>
  );
}
