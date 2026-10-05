"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { BrokerCash } from "@/lib/investments/broker-cash";

export interface BrokerCashCardProps { cash: BrokerCash[]; securitiesValue: number; currency: string; incomplete: boolean }

/** Current securities plus linked broker cash, without adding cash again to the global net worth. */
export function BrokerCashCard({ cash, securitiesValue, currency, incomplete }: BrokerCashCardProps) {
  if (!cash.length) return null;
  const cashTotal = cash.reduce((total, account) => total + account.balance, 0);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Portafoglio, inclusa la liquidità</CardTitle>
        <p className="font-heading text-4xl font-medium tabular-nums">{formatCurrency(securitiesValue + cashTotal, currency)}</p>
        <p className="text-sm text-muted-foreground">
          Titoli {formatCurrency(securitiesValue, currency)} · Liquidità broker {formatCurrency(cashTotal, currency)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {cash.map((account) => (
          <div key={account.accountId} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <div>
              <p>{account.name}</p>
              <p className="text-xs text-muted-foreground">{account.statementDate ? `Ultimo rendiconto: ${account.statementDate.split("-").reverse().join("/")}` : "Saldo del conto collegato"}</p>
            </div>
            <p className={`tabular-nums ${account.balance < 0 ? "text-neg" : ""}`}>{formatCurrency(account.balance, currency)}</p>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">La liquidità è il saldo dei conti collegati, aggiornato con gli import. È già inclusa in Conti e nel patrimonio complessivo. Grafici e rendimenti dei titoli escludono il cash.</p>
        {incomplete ? <p className="text-sm text-muted-foreground">Totale parziale: alcuni titoli non hanno ancora un prezzo.</p> : null}
      </CardContent>
    </Card>
  );
}
