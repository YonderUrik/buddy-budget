"use client";

/** Card "Aliquote degli strumenti": aliquota e armonizzazione usate per ogni strumento, con la loro origine e "Modifica". */

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isFund } from "@/lib/calc/taxes";
import type { Instrument } from "@/lib/db/schema/investments";
import type { ResolvedTaxSettings, TaxRateSource } from "@/lib/investments/tax-settings";
import { formatPct } from "../percent";

const SOURCE_LABELS: Record<TaxRateSource, string> = {
  manuale: "impostata da te",
  titolo_di_stato: "titolo di Stato, dal nome",
  strumento: "ordinaria",
};

export interface InstrumentTaxListCardProps {
  instruments: Instrument[];
  resolved: Map<string, ResolvedTaxSettings>;
  onEdit: (instrument: Instrument) => void;
}

export function InstrumentTaxListCard({ instruments, resolved, onEdit }: InstrumentTaxListCardProps) {
  const shown = instruments.filter((i) => i.type !== "crypto" && resolved.has(i.id));
  if (shown.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Aliquote degli strumenti</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y divide-border">
          {shown.map((instrument) => {
            const settings = resolved.get(instrument.id)!;
            return (
              <li key={instrument.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 text-sm">
                  <p className="truncate text-foreground">{instrument.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPct(settings.taxRate)} · {SOURCE_LABELS[settings.taxRateSource]}
                    {isFund(instrument.type) ? ` · ${settings.harmonized ? "armonizzato" : "non armonizzato"}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onEdit(instrument)}>
                  Modifica
                </Button>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
