"use client";

/**
 * Card "Prossimi 12 mesi": quanto dovresti incassare da dividendi e cedole, mese per mese, e l'elenco dei prossimi
 * incassi. Stima: stacchi dell'ultimo anno ripetuti, cedole dai termini inseriti; ritenute estere escluse.
 */

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatCurrency, formatDateWithYear } from "@/lib/format";
import type { IncomeForecast, ProjectedIncome } from "@/lib/investments/dividends";
import { shortMonthLabel } from "../percent";
import { MonthBars } from "./month-bars";
import { CalendarClockIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

/** Prossimi incassi mostrati prima di "Mostra tutti". */
export const FORECAST_EVENTS_LIMIT = 6;

const BASIS_LABELS: Record<ProjectedIncome["basis"], string> = {
  fonte: "come l'anno scorso",
  cedola: "dalla cedola",
  storico: "dai tuoi incassi",
};

/** "ottobre 2026 a settembre 2027". */
function periodLabel(forecast: IncomeForecast): string {
  const format = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
  const label = (key: string) => format.format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1));
  const first = forecast.months[0]?.key;
  const last = forecast.months.at(-1)?.key;
  return first && last ? `${label(first)} a ${label(last)}` : "";
}

export interface IncomeForecastCardProps {
  forecast: IncomeForecast;
  instrumentsById: Map<string, Instrument>;
  currency: string;
  /** Apre l'inserimento delle cedole di un'obbligazione. */
  onEditCoupons: (instrument: Instrument) => void;
}

export function IncomeForecastCard({ forecast, instrumentsById, currency, onEditCoupons }: IncomeForecastCardProps) {
  const [showAll, setShowAll] = React.useState(false);
  const format = (amount: number) => formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  const events = showAll ? forecast.events : forecast.events.slice(0, FORECAST_EVENTS_LIMIT);
  const missingTerms = forecast.bondsWithoutTerms.map((id) => instrumentsById.get(id)).filter((i): i is Instrument => i !== undefined);

  return (
    <PanelSection icon={CalendarClockIcon} title="Prossimi 12 mesi" color="var(--swatch-amber)">
      <div className="flex flex-col gap-5">
        {forecast.events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun incasso previsto: i tuoi strumenti non hanno staccato dividendi nell&apos;ultimo anno (es. ETF ad accumulazione).
          </p>
        ) : (
          <>
            <p className="max-w-prose text-base text-foreground">
              Da {periodLabel(forecast)}, con le quote di oggi dovresti incassare circa <span className="font-semibold tabular-nums text-pos">{format(forecast.totalNet)}</span> netti
              <span className="text-muted-foreground"> ({format(forecast.totalGross)} lordi), circa {format(forecast.totalNet / 12)} al mese.</span>
            </p>
            <MonthBars
              ariaLabel="Incassi previsti per mese"
              bars={forecast.months.map((m) => ({
                key: m.key,
                label: shortMonthLabel(m.key),
                primary: m.net,
                secondary: m.gross - m.net,
                title: `${shortMonthLabel(m.key)} ${m.key.slice(0, 4)}: ${format(m.net)} netti, ${format(m.gross)} lordi`,
              }))}
            />
            <ul className="flex flex-col divide-y divide-border">
              {events.map((event) => (
                <li key={`${event.instrumentId}-${event.kind}-${event.date}`} className="flex items-baseline justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate text-foreground">{instrumentsById.get(event.instrumentId)?.name ?? "Strumento"}</span>
                    <span className="text-xs text-muted-foreground">
                      {event.kind === "rimborso" ? "Rimborso a scadenza" : event.kind === "cedola" ? "Cedola" : "Stacco"} del {formatDateWithYear(event.date)} ·{" "}
                      {BASIS_LABELS[event.basis]}
                    </span>
                  </span>
                  <span className="shrink-0 text-right tabular-nums">
                    <span className={event.kind === "rimborso" ? "text-foreground" : "text-pos"}>{formatCurrency(event.net, currency)}</span>
                    {event.kind !== "rimborso" ? <span className="block text-xs text-muted-foreground">{formatCurrency(event.gross, currency)} lordi</span> : null}
                  </span>
                </li>
              ))}
            </ul>
            {forecast.events.length > FORECAST_EVENTS_LIMIT ? (
              <Button variant="ghost" size="sm" className="self-start" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Mostra meno" : `Mostra tutti (${forecast.events.length})`}
              </Button>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Stima per data di stacco, netta della sola imposta italiana: sui dividendi esteri c&apos;è anche la ritenuta del paese
              d&apos;origine. Il rimborso di un&apos;obbligazione è capitale che torna, non un provento.
            </p>
          </>
        )}
        {missingTerms.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg bg-muted/60 p-3 text-sm">
            <p className="text-foreground">Per prevedere le cedole servono tasso e scadenza di:</p>
            <ul className="flex flex-wrap gap-2">
              {missingTerms.map((instrument) => (
                <li key={instrument.id}>
                  <Button variant="outline" size="sm" onClick={() => onEditCoupons(instrument)}>
                    {instrument.name}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </PanelSection>
  );
}
