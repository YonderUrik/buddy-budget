"use client";

/**
 * Card "Per strumento": incassato negli ultimi 12 mesi, rendimento sul costo e attuale (lordo previsto sul valore di
 * oggi), crescita del dividendo per quota negli ultimi anni. Per le obbligazioni, tasso e scadenza delle cedole.
 */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/domain/shared";
import type { Instrument } from "@/lib/db/schema/investments";
import { formatCurrency } from "@/lib/format";
import type { IncomeInstrumentRow } from "@/lib/investments/dividends";
import { formatSignedPct } from "../gain-text";
import { formatPct } from "../percent";

export interface IncomeInstrumentsCardProps {
  rows: IncomeInstrumentRow[];
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

export function IncomeInstrumentsCard({ rows, instrumentsById, currency, onEditCoupons }: IncomeInstrumentsCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-1">
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Per strumento</CardTitle>
        <InfoHint label="Come leggere i rendimenti da dividendo">
          <strong>Sul costo</strong>: netto incassato negli ultimi 12 mesi su quanto hai pagato le quote che hai.{" "}
          <strong>Attuale</strong>: lordo previsto nei prossimi 12 mesi sul valore di oggi. <strong>Crescita</strong>: di quanto è
          cresciuto ogni anno il dividendo per quota, sugli ultimi anni completi.
        </InfoHint>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((row) => {
            const instrument = instrumentsById.get(row.instrumentId);
            if (!instrument) return null;
            const isBond = instrument.type === "obbligazione";
            return (
              <li key={row.instrumentId} className="flex flex-col gap-2 py-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-foreground">{instrument.name}</p>
                  {isBond ? (
                    <Button variant="outline" size="sm" onClick={() => onEditCoupons(instrument)}>
                      {row.hasCouponTerms ? "Cedole" : "Inserisci cedole"}
                    </Button>
                  ) : null}
                </div>
                <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                  <Metric label="Ultimi 12 mesi" value={formatCurrency(row.trailingNet, currency, { maximumFractionDigits: 0 })} />
                  <Metric label="Sul costo" value={row.yieldOnCost !== null && row.trailingNet > 0 ? formatPct(row.yieldOnCost) : "—"} />
                  <Metric label="Attuale" value={row.currentYield !== null && row.forecastGross > 0 ? formatPct(row.currentYield) : "—"} />
                  <Metric label="Crescita" value={row.growth ? `${formatSignedPct(row.growth.rate)}/anno` : "—"} />
                </dl>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
