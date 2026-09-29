"use client";

/**
 * Risultati della ricerca strumenti divisi per tipo (ETF, azioni, fondi, obbligazioni, ETC, crypto), ognuno col
 * colore del proprio tipo, lo stesso di posizioni e composizione. Con più di un tipo compaiono dei filtri rapidi.
 * Solo presentazione: gruppi e callback arrivano dal selettore.
 */

import * as React from "react";
import type { Instrument, InstrumentType } from "@/lib/db/schema/investments";
import type { MarketSearchItem, SearchResultGroup } from "@/lib/investments/search-results";
import { INSTRUMENT_TYPE_LABELS, INSTRUMENT_TYPE_SINGULAR } from "@/lib/investments/labels";
import { cn } from "@/lib/utils";
import { INSTRUMENT_TYPE_COLOR } from "./instrument-colors";

export interface InstrumentSearchResultsProps {
  /** Strumenti già presenti nell'app che corrispondono alla ricerca. */
  known: Instrument[];
  /** Titolo della sezione degli strumenti già presenti. */
  knownTitle?: string;
  groups: SearchResultGroup[];
  /** Valuta in cui si aggiungono le crypto, mostrata accanto al simbolo. */
  cryptoCurrency: string;
  disabled?: boolean;
  onChoose: (instrument: Instrument) => void;
  onAdd: (item: MarketSearchItem) => void;
}

function TypeDot({ type }: { type: InstrumentType }) {
  return <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: INSTRUMENT_TYPE_COLOR[type] }} aria-hidden="true" />;
}

/** Etichetta del tipo di uno strumento: pallino colorato + nome. */
export function InstrumentTypeTag({ type }: { type: InstrumentType }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
      <TypeDot type={type} />
      {INSTRUMENT_TYPE_SINGULAR[type]}
    </span>
  );
}

function ResultButton(props: { title: string; detail: string; tag?: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:opacity-50"
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm text-foreground">{props.title}</span>
        <span className="truncate text-xs text-muted-foreground">{props.detail}</span>
      </span>
      {props.tag}
    </button>
  );
}

function GroupHeader({ type, count }: { type: InstrumentType; count: number }) {
  return (
    <p className="flex items-center gap-2 px-2 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground">
      <TypeDot type={type} />
      <span>
        {INSTRUMENT_TYPE_LABELS[type]} <span className="font-normal text-muted-foreground">({count})</span>
      </span>
    </p>
  );
}

function itemView(item: MarketSearchItem, cryptoCurrency: string): { key: string; title: string; detail: string } {
  if (item.source === "coingecko") {
    return { key: `cg:${item.coin.id}`, title: item.coin.name, detail: `${item.coin.symbol.toUpperCase()} · in ${cryptoCurrency}` };
  }
  const { hit } = item;
  return { key: `y:${hit.symbol}`, title: hit.name, detail: [hit.symbol, hit.exchangeLabel].filter(Boolean).join(" · ") };
}

export function InstrumentSearchResults({
  known,
  knownTitle = "Già aggiunti",
  groups,
  cryptoCurrency,
  disabled,
  onChoose,
  onAdd,
}: InstrumentSearchResultsProps) {
  const [filter, setFilter] = React.useState<InstrumentType | null>(null);
  const types = groups.map((g) => g.type);
  // Un filtro su un tipo che non c'è più (ricerca cambiata) vale come "Tutti".
  const active = filter && types.includes(filter) ? filter : null;
  const visible = active ? groups.filter((g) => g.type === active) : groups;

  return (
    <>
      {known.length ? (
        <div className="flex flex-col gap-0.5">
          <p className="px-2 pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{knownTitle}</p>
          {known.map((i) => (
            <ResultButton
              key={i.id}
              title={i.name}
              detail={[i.currency, i.isin].filter(Boolean).join(" · ")}
              tag={<InstrumentTypeTag type={i.type} />}
              onClick={() => onChoose(i)}
            />
          ))}
        </div>
      ) : null}
      {groups.length > 1 ? (
        <div role="group" aria-label="Filtra per tipo" className="flex flex-wrap gap-1 px-2 pt-3">
          {[null, ...types].map((type) => (
            <button
              key={type ?? "tutti"}
              type="button"
              aria-pressed={active === type}
              onClick={() => setFilter(type)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs",
                active === type ? "border-foreground bg-foreground text-background" : "border-input text-foreground hover:bg-muted"
              )}
            >
              {type ? <TypeDot type={type} /> : null}
              {type ? INSTRUMENT_TYPE_LABELS[type] : "Tutti"}
            </button>
          ))}
        </div>
      ) : null}
      {visible.map((group) => (
        <div key={group.type} className="flex flex-col gap-0.5">
          <GroupHeader type={group.type} count={group.items.length} />
          {/* Barra del colore del tipo accanto ai risultati: il gruppo si riconosce anche scorrendo. */}
          <div className="ml-2 flex flex-col gap-0.5 border-l-2 pl-1" style={{ borderLeftColor: INSTRUMENT_TYPE_COLOR[group.type] }}>
            {group.items.map((item) => {
              const view = itemView(item, cryptoCurrency);
              return <ResultButton key={view.key} title={view.title} detail={view.detail} disabled={disabled} onClick={() => onAdd(item)} />;
            })}
          </div>
        </div>
      ))}
    </>
  );
}
