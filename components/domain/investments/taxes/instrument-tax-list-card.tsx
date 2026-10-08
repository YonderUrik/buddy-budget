"use client";

/** Card "Aliquote degli strumenti": aliquota e armonizzazione usate per ogni strumento, con la loro origine e "Modifica". */

import { Button } from "@/components/ui/button";
import { isFund } from "@/lib/calc/taxes";
import type { Instrument } from "@/lib/db/schema/investments";
import type { ResolvedTaxSettings, TaxRateSource } from "@/lib/investments/tax-settings";
import { formatPct } from "../percent";
import { InstrumentIcon } from "../instrument-icon";
import { ListIcon } from "lucide-react";
import { PanelSection } from "../panel-section";

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
    <PanelSection icon={ListIcon} title="Aliquote degli strumenti" color="var(--swatch-slate)">
      <ul className="flex flex-col divide-y divide-border">
        {shown.map((instrument) => {
          const settings = resolved.get(instrument.id)!;
          return (
            <li key={instrument.id} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2.5 text-sm">
                <InstrumentIcon type={instrument.type} name={instrument.name} instrumentId={instrument.id} size="sm" />
                <div className="min-w-0">
                  <p className="truncate text-foreground">{instrument.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatPct(settings.taxRate)} · {SOURCE_LABELS[settings.taxRateSource]}
                    {isFund(instrument.type) ? ` · ${settings.harmonized ? "armonizzato" : "non armonizzato"}` : ""}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onEdit(instrument)}>
                Modifica
              </Button>
            </li>
          );
        })}
      </ul>
    
    </PanelSection>
  );
}
