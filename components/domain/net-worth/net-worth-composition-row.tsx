/** Riga di mini-card con la composizione del patrimonio: una card per classe di asset esistente, ciascuna col link alla sua sezione. */

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { NetWorthCompositionItem } from "./net-worth-composition-row.utils";

export interface NetWorthCompositionRowProps {
  items: NetWorthCompositionItem[];
  currency: string;
}

export function NetWorthCompositionRow({ items, currency }: NetWorthCompositionRowProps) {
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <Link key={item.key} href={item.href} className="rounded-xl transition-opacity hover:opacity-80">
          <Card>
            <CardContent className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="font-heading text-2xl font-medium tabular-nums text-foreground">
                {formatCurrency(item.amount, currency, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-sm text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}
