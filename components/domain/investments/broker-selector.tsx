"use client";
import { track } from "@/lib/analytics";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { investmentBrokerGroups } from "@/lib/investments/broker-filter";
import { useBrokerSelection } from "@/lib/investments/broker-selection";
import type { InvestmentData } from "@/lib/investments/data";

/** Include/exclude broker histories from the combined investment view without removing imports. */
export function BrokerSelector({ data }: { data: InvestmentData }) {
  const { disabled, toggle, showAll } = useBrokerSelection();
  const groups = useMemo(() => investmentBrokerGroups(data), [data]);
  if (!groups.some((g) => g.id !== "manual")) return null;
  const enabled = groups.filter((g) => !disabled.has(g.id));
  return <section className="space-y-2 rounded-xl border p-3" aria-label="Broker inclusi nella vista">
    <p className="text-sm font-medium">Broker inclusi nel portafoglio</p>
    <div className="flex flex-wrap gap-3">{groups.map((group) => <label key={group.id} className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-primary" checked={!disabled.has(group.id)} onChange={() => { toggle(group.id); track("investment_broker_filter_changed", { action: "toggle", selected: enabled.length + (disabled.has(group.id) ? 1 : -1) }); }} />{group.label}</label>)}<Button size="sm" variant="ghost" onClick={() => { showAll(); track("investment_broker_filter_changed", { action: "all", selected: groups.length }); }}>Mostra tutti</Button></div>
    <p className="text-xs text-muted-foreground">Filtro temporaneo per totali, posizioni, performance, proventi, tasse e operazioni. Gli import restano salvati. Il patrimonio generale e i saldi dei conti non cambiano.</p>
    {!enabled.length ? <p role="status" className="text-sm">Nessun broker selezionato. Riattiva un broker per visualizzare i suoi investimenti.</p> : null}
  </section>;
}
