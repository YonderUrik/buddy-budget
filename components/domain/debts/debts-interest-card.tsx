/** "Dove paghi di più": gli interessi di un anno, ai saldi e ai tassi di oggi, divisi per debito. */

import Link from "next/link";
import { CoinsIcon } from "lucide-react";
import { MoneyHero } from "@/components/domain/net-worth";
import { PanelSection } from "@/components/domain/investments";
import type { YearlyInterest } from "@/lib/debts/overview-insights";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DEBTS_COLORS } from "./debts-theme";

export interface DebtsInterestCardProps {
  interest: YearlyInterest;
  currency: string;
  /** Dove porta un finanziamento (riceve l'id). */
  hrefFor?: (id: string) => string;
}

/** Tinte del colore primario, dalla più scura: legano la fetta della barra alla sua riga. */
const SEGMENT_CLASSES = ["bg-primary", "bg-primary/70", "bg-primary/45", "bg-primary/25"] as const;

const defaultHref = (id: string) => `/debiti/finanziamenti?id=${id}`;

export function DebtsInterestCard({ interest, currency, hrefFor = defaultHref }: DebtsInterestCardProps) {
  if (interest.items.length === 0) return null;
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  const tone = (index: number) => SEGMENT_CLASSES[Math.min(index, SEGMENT_CLASSES.length - 1)];
  return (
    <PanelSection icon={CoinsIcon} title="Dove paghi di più" color={DEBTS_COLORS.interest} className="gap-4">
      <div>
        <MoneyHero value={interest.total} currency={currency} className="text-3xl" />
        <p className="text-sm text-muted-foreground">di interessi in un anno, ai saldi e ai tassi di oggi</p>
      </div>
      <div className="flex h-3 overflow-hidden rounded-full bg-border" role="img" aria-label={interest.items.map((i) => `${i.name} ${Math.round(i.share * 100)}%`).join(", ")}>
        {interest.items.map((item, index) => (
          <span key={item.id} className={cn("h-full", tone(index))} style={{ width: `${item.share * 100}%` }} />
        ))}
      </div>
      <ul>
        {interest.items.map((item, index) => (
          <li key={item.id} className="border-b last:border-b-0">
            <Link href={hrefFor(item.id)} className="flex items-center gap-3 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className={cn("size-3 shrink-0 rounded-sm", tone(index))} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
              <span className="font-heading text-sm font-medium tabular-nums text-foreground">{money(item.yearly)}</span>
              <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(item.share * 100)}%</span>
            </Link>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}
