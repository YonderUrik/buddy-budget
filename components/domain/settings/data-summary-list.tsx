/** Elenco compatto dei conteggi dei dati dell'utente (riepilogo mostrato prima di esportare, resettare o eliminare). */

import type { UserDataSummary } from "@/lib/account/lifecycle";
import { dataSummaryItems } from "./data-summary.utils";

export function DataSummaryList({ summary }: { summary: UserDataSummary }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
      {dataSummaryItems(summary).map((item) => (
        <div key={item.label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1.5">
          <dt className="text-muted-foreground">{item.label}</dt>
          <dd className="font-heading font-medium tabular-nums text-foreground">{item.value.toLocaleString("it-IT")}</dd>
        </div>
      ))}
    </dl>
  );
}
