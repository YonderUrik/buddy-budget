"use client";

/**
 * Riga di «Fatte da sole»: un esercente con i movimenti categorizzati da soli, la categoria applicata (toccandola si
 * cambia) e da dove viene. I movimenti si aprono a richiesta. Non scrive nulla: passa la scelta a `onCorrect`.
 */

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { CategoryAvatar, CategorySheet } from "@/components/domain/categories";
import { Checkbox } from "@/components/ui/checkbox";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { AutoCategorizedGroup } from "@/lib/categorization/auto-review";
import { dateRangeLabel } from "@/lib/categorization/origin";
import type { Category } from "@/lib/db/schema/categories";
import { formatCurrency } from "@/lib/format";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { cn } from "@/lib/utils";
import { MerchantLogo } from "./merchant-logo";
import { MovementsPreview } from "./movements-preview";
import { AutoOriginBadge } from "./suggestion-origin";

export interface AutoCategorizedRowProps {
  group: AutoCategorizedGroup;
  categories: Category[];
  currency: string;
  categoryUsage?: CategoryUsageCounts;
  /** La correzione è in corso: il pulsante della categoria resta fermo. */
  busy?: boolean;
  /** L'utente ha scelto un'altra categoria; `remember` crea o aggiorna la regola dell'esercente. */
  onCorrect: (categoryId: string, remember: boolean) => void;
  onRemoteLogo?: () => void;
}

export function AutoCategorizedRow({ group, categories, currency, categoryUsage, busy = false, onCorrect, onRemoteLogo }: AutoCategorizedRowProps) {
  const [picking, setPicking] = React.useState(false);
  // Una correzione di solito vale anche per i prossimi movimenti: senza, una regola sbagliata li rimetterebbe lì.
  const [remember, setRemember] = React.useState(true);
  const [expanded, setExpanded] = React.useState(false);
  const rememberId = React.useId();
  const detailsId = React.useId();
  const category = categories.find((item) => item.id === group.categoryId);
  const isIncome = group.totalAmount > 0;
  const count = group.transactionIds.length;
  const selectable = React.useMemo(
    () =>
      categories.filter(
        (item) => !item.isFallback && item.id !== group.categoryId && (item.type === "trasferimento" || (isIncome ? item.type === "entrata" : item.type !== "entrata"))
      ),
    [categories, group.categoryId, isIncome]
  );

  return (
    <li className="flex gap-3 py-3">
      <MerchantLogo name={group.label} size="md" onRemoteLogo={onRemoteLogo} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-controls={detailsId}
            className="flex min-w-0 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="line-clamp-2 text-sm font-medium break-words text-foreground">{group.label}</span>
            <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
              {count === 1 ? "1 movimento" : `${count} movimenti`} · {dateRangeLabel(group.transactionDates)}
              <ChevronDownIcon className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden="true" />
            </span>
          </button>
          <span className={cn("shrink-0 text-sm font-medium tabular-nums", isIncome ? "text-pos" : "text-foreground")}>
            {formatCurrency(group.totalAmount, currency)}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={busy}
            title="Cambia categoria"
            className="flex min-h-9 max-w-full items-center gap-1.5 rounded-full bg-foreground/[0.05] py-1 pr-2.5 pl-1 text-sm font-medium text-foreground outline-none hover:bg-foreground/[0.09] focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:min-h-8"
          >
            {category ? <CategoryAvatar icon={category.icon as CategoryIcon} color={category.color as CategoryColor} size={12} className="size-6" /> : null}
            <span className="truncate">{category?.name ?? "Categoria"}</span>
            <ChevronDownIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          </button>
          <AutoOriginBadge source={group.source} confidence={group.confidence} />
        </div>

        {expanded ? (
          <div id={detailsId} className="border-l border-border pl-3">
            <MovementsPreview
              label={group.label}
              dates={group.transactionDates}
              amounts={group.transactionAmounts}
              descriptions={group.transactionDescriptions}
              currency={currency}
              limit={count}
            />
          </div>
        ) : null}
      </div>

      <CategorySheet
        open={picking}
        onOpenChange={setPicking}
        categories={selectable}
        usage={categoryUsage}
        title="Cambia categoria"
        description={group.label}
        onPick={(categoryId) => {
          setPicking(false);
          onCorrect(categoryId, remember);
        }}
        footer={
          <label htmlFor={rememberId} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-foreground/[0.04] px-3 text-sm">
            <Checkbox id={rememberId} checked={remember} onCheckedChange={(checked) => setRemember(checked === true)} />
            <span className="min-w-0">Usa sempre questa categoria per «{group.label}»</span>
          </label>
        }
      />
    </li>
  );
}
