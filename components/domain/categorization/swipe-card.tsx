"use client";

/**
 * Carta di un esercente nella categorizzazione rapida: nome, importo, categoria proposta e, con la carta in cima,
 * trascinamento a destra per confermare o a sinistra per cambiare. Non decide nulla da sola: chiama le callback.
 */

import * as React from "react";
import { motion, useMotionValue, useTransform } from "motion/react";
import { CategoryPicker } from "@/components/domain/categories";
import { Checkbox } from "@/components/ui/checkbox";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { SuggestionSourceBadge } from "./suggestion-source-badge";

/** Distanza di trascinamento oltre la quale il gesto vale come scelta. */
export const SWIPE_COMMIT_DISTANCE = 110;
/** Quante descrizioni grezze mostrare sotto il nome. */
const DESCRIPTION_PREVIEW_LIMIT = 3;
/** Inclinazione massima della carta in gradi. */
const MAX_TILT_DEGREES = 8;

export interface SwipeCardProps {
  group: SuggestionGroup;
  currency: string;
  categories: Category[];
  categoryUsage?: CategoryUsageCounts;
  /** Nome della categoria proposta (assente se la carta non ha proposte). */
  suggestedName?: string;
  /** Mostra il selettore di un'altra categoria al posto dei pulsanti. */
  changing: boolean;
  remember: boolean;
  onRememberChange: (remember: boolean) => void;
  onConfirm: () => void;
  onChange: () => void;
  onPick: (categoryId: string) => void;
}

export function SwipeCard({
  group,
  currency,
  categories,
  categoryUsage,
  suggestedName,
  changing,
  remember,
  onRememberChange,
  onConfirm,
  onChange,
  onPick,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-MAX_TILT_DEGREES, MAX_TILT_DEGREES]);
  const confirmOpacity = useTransform(x, [20, SWIPE_COMMIT_DISTANCE], [0, 1]);
  const changeOpacity = useTransform(x, [-SWIPE_COMMIT_DISTANCE, -20], [1, 0]);
  const rememberId = React.useId();
  const isIncome = group.totalAmount > 0;
  const hasSuggestion = Boolean(group.suggestion);
  const selectable = React.useMemo(
    () => categories.filter((c) => !c.isFallback && (isIncome ? c.type === "entrata" : c.type !== "entrata")),
    [categories, isIncome]
  );
  const descriptions = [...new Set(group.transactionDescriptions)].slice(0, DESCRIPTION_PREVIEW_LIMIT);

  return (
    <motion.div
      style={{ x, rotate }}
      drag={changing ? false : "x"}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        if (info.offset.x > SWIPE_COMMIT_DISTANCE && hasSuggestion) onConfirm();
        else if (info.offset.x < -SWIPE_COMMIT_DISTANCE) onChange();
      }}
      className="relative flex touch-pan-y flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-lg select-none"
    >
      <motion.span style={{ opacity: confirmOpacity }} className="pointer-events-none absolute top-4 left-4 rounded-md border-2 border-pos px-2 py-0.5 text-sm font-semibold text-pos">
        È questa
      </motion.span>
      <motion.span style={{ opacity: changeOpacity }} className="pointer-events-none absolute top-4 right-4 rounded-md border-2 border-neg px-2 py-0.5 text-sm font-semibold text-neg">
        Un&apos;altra
      </motion.span>

      <div className="flex flex-col gap-1 pt-6 text-center">
        <p className="font-heading text-xl font-medium break-words text-foreground">{group.label}</p>
        <p className={cn("text-lg font-medium tabular-nums", isIncome ? "text-pos" : "text-foreground")}>
          {formatCurrency(group.totalAmount, currency)}
        </p>
        <p className="text-xs text-muted-foreground">
          {group.transactionIds.length === 1 ? "1 movimento" : `${group.transactionIds.length} movimenti`}
        </p>
      </div>

      {descriptions.length > 1 || (descriptions[0] && descriptions[0] !== group.label) ? (
        <ul className="flex flex-col gap-0.5 text-xs text-muted-foreground">
          {descriptions.map((description) => (
            <li key={description} className="truncate">{description}</li>
          ))}
        </ul>
      ) : null}

      {changing || !hasSuggestion ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{changing ? "Scegli la categoria giusta" : "Nessuna proposta: scegli tu"}</p>
          <CategoryPicker categories={selectable} value="" onValueChange={onPick} usage={categoryUsage} placeholder="Scegli categoria" className="w-full" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/60 p-4 text-center">
          <p className="text-xs text-muted-foreground">Categoria proposta</p>
          <p className="font-heading text-lg font-medium text-foreground">{suggestedName}</p>
          {group.suggestion && <SuggestionSourceBadge suggestion={group.suggestion} />}
        </div>
      )}

      <label htmlFor={rememberId} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox id={rememberId} checked={remember} onCheckedChange={(checked) => onRememberChange(checked === true)} />
        Ricorda per questo esercente
      </label>
    </motion.div>
  );
}
