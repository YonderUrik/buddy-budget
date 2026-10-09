"use client";
import { track } from "@/lib/analytics";
import { useMemo } from "react";
import { LandmarkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { investmentBrokerGroups } from "@/lib/investments/broker-filter";
import { useBrokerSelection } from "@/lib/investments/broker-selection";
import type { InvestmentData } from "@/lib/investments/data";
import { cn } from "@/lib/utils";

/**
 * Chip compatto «Broker: tutti / 2 di 3» che apre l'elenco dei broker da includere nei numeri della sezione.
 * Il filtro è temporaneo: gli import restano salvati e patrimonio e saldi dei conti non cambiano.
 */
export function BrokerSelector({ data }: { data: InvestmentData }) {
  const { disabled, toggle, showAll } = useBrokerSelection();
  const groups = useMemo(() => investmentBrokerGroups(data), [data]);
  if (!groups.some((g) => g.id !== "manual")) return null;
  const enabled = groups.filter((g) => !disabled.has(g.id));
  const filtered = enabled.length < groups.length;
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {!enabled.length ? <p role="status" className="text-sm text-muted-foreground">Nessun broker selezionato: riattivane uno per vedere i suoi investimenti.</p> : null}
      <Popover>
        <PopoverTrigger className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm hover:bg-muted", filtered && "border-primary/40 bg-primary/10 text-primary")} aria-label="Scegli i broker inclusi nei numeri">
          <LandmarkIcon className="size-3.5" aria-hidden="true" />
          {filtered ? `Broker: ${enabled.length} di ${groups.length}` : "Tutti i broker"}
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <p className="text-sm font-medium">Broker inclusi nei numeri</p>
          <div className="flex flex-col gap-2">
            {groups.map((group) => (
              <label key={group.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-primary" checked={!disabled.has(group.id)} onChange={() => { toggle(group.id); track("investment_broker_filter_changed", { action: "toggle", selected: enabled.length + (disabled.has(group.id) ? 1 : -1) }); }} />
                {group.label}
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Vale per totali, posizioni, performance, proventi, tasse e operazioni. Gli import restano salvati e il patrimonio generale non cambia.</p>
          {filtered ? <Button size="sm" variant="ghost" onClick={() => { showAll(); track("investment_broker_filter_changed", { action: "all", selected: groups.length }); }}>Mostra tutti</Button> : null}
        </PopoverContent>
      </Popover>
    </div>
  );
}
