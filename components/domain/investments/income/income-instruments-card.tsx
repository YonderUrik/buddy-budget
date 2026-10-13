"use client";

/**
 * Card "Per strumento": incassato negli ultimi 12 mesi, rendimento sul costo e attuale (lordo previsto sul valore di
 * oggi), crescita del dividendo per quota negli ultimi anni. Per le obbligazioni, tasso e scadenza delle cedole.
 */

import { ChevronDown } from "lucide-react";
import { IncomePayments } from "./income-payments";
import type { IncomePayment } from "@/lib/investments/income";
import { track } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import { InfoHint } from "@/components/domain/shared";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatCurrency } from "@/lib/format";
import type { IncomeInstrumentRow } from "@/lib/investments/dividends";
import { formatSignedPct } from "../gain-text";
import { InstrumentIcon } from "../instrument-icon";
import { formatPct } from "../percent";
import { ListIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

export interface IncomeInstrumentsCardProps {
  rows: IncomeInstrumentRow[];
  payments: IncomePayment[];
  instrumentsById: Map<string, Instrument>;
  currency: string;
  onEditCoupons: (instrument: Instrument) => void;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

export function IncomeInstrumentsCard({ rows, payments, instrumentsById, currency, onEditCoupons }: IncomeInstrumentsCardProps) {
  return (
    <PanelSection icon={ListIcon} title="Per strumento" color="var(--swatch-slate)"
      action={
        <InfoHint label="Come leggere i rendimenti da dividendo">
          <strong>Sul costo</strong>: netto incassato negli ultimi 12 mesi su quanto hai pagato le quote che hai.{" "}
          <strong>Attuale</strong>: lordo previsto nei prossimi 12 mesi sul valore di oggi. <strong>Crescita</strong>: di quanto è
          cresciuto ogni anno il dividendo per quota, sugli ultimi anni completi.
        </InfoHint>
      }>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((row) => {
          const instrument = instrumentsById.get(row.instrumentId);
          if (!instrument) return null;
          const isBond = instrument.type === "obbligazione";
          const instrumentPayments = payments.filter((payment) => payment.instrumentId === row.instrumentId);
          return (
            <li key={row.instrumentId}>
              <details className="group" onToggle={(event) => { if (event.currentTarget.open) track("investment_dividends_details_opened", { source: "instrument" }); }}>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-md py-4 focus-visible:outline-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <InstrumentIcon type={instrument.type} name={instrument.name} instrumentId={instrument.id} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{instrument.name}</span>
                      <span className="text-xs text-muted-foreground">{instrumentPayments.length} {instrumentPayments.length === 1 ? "pagamento" : "pagamenti"}</span>
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-right"><span className="block text-sm tabular-nums">{formatCurrency(row.trailingNet, currency)}</span><span className="text-xs text-muted-foreground">ultimi 12 mesi</span></span>
                    <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                  </span>
                </summary>
                <div className="space-y-4 border-t pb-3 pt-4">
                  <dl className="grid grid-cols-3 gap-2 text-sm">
                    <Metric label="Sul costo" value={row.yieldOnCost !== null && row.trailingNet > 0 ? formatPct(row.yieldOnCost) : "—"} />
                    <Metric label="Attuale" value={row.currentYield !== null && row.forecastGross > 0 ? formatPct(row.currentYield) : "—"} />
                    <Metric label="Crescita" value={row.growth ? `${formatSignedPct(row.growth.rate)}/anno` : "—"} />
                  </dl>
                  {isBond ? <Button variant="outline" size="sm" onClick={() => onEditCoupons(instrument)}>{row.hasCouponTerms ? "Cedole" : "Inserisci cedole"}</Button> : null}
                  <IncomePayments payments={instrumentPayments} currency={currency} />
                </div>
              </details>
            </li>
          );
        })}
      </ul>
    
    </PanelSection>
  );
}
