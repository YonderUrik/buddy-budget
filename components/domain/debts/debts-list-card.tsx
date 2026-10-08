/** "I tuoi debiti": una riga per finanziamento, con avanzamento; porta al dettaglio. */

import Link from "next/link";
import { ChevronRightIcon, LandmarkIcon } from "lucide-react";
import { PanelSection } from "@/components/domain/investments";
import type { DebtView } from "@/lib/debts/view";
import { formatCurrency } from "@/lib/format";
import { formatMonthYear } from "./debts-format";
import { repaidShare } from "./debt-facts";
import { DEBTS_COLORS } from "./debts-theme";

export interface DebtsListCardProps {
  debts: DebtView[];
  currency: string;
}

const percent = (value: number) => `${value.toFixed(2).replace(".", ",")}%`;

function Row({ href, name, detail, amount, share }: { href: string; name: string; detail: string; amount: string; share: number }) {
  return (
    <li className="border-b last:border-b-0">
      <Link href={href} className="flex items-center gap-3 rounded-lg py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-border" aria-hidden="true">
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(1, share) * 100}%` }} />
          </span>
          <span className="text-xs text-muted-foreground">{detail}</span>
        </span>
        <span className="font-heading text-base font-medium tabular-nums text-foreground">{amount}</span>
        <ChevronRightIcon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function DebtsListCard({ debts, currency }: DebtsListCardProps) {
  const money = (value: number) => formatCurrency(value, currency, { maximumFractionDigits: 0 });
  return (
    <PanelSection icon={LandmarkIcon} title="I tuoi debiti" color={DEBTS_COLORS.list}>
      <ul>
        {debts.map((debt) => (
          <Row
            key={debt.id}
            href={`/debiti/finanziamenti?id=${debt.id}`}
            name={debt.name}
            detail={debt.plan.totals.finished ? "Estinto" : `finisce a ${formatMonthYear(debt.plan.totals.endDate)}${debt.apr !== null ? ` · ${percent(debt.apr)} TAEG` : ""}`}
            amount={money(debt.plan.totals.residual)}
            share={repaidShare(debt)}
          />
        ))}
      </ul>
    </PanelSection>
  );
}
