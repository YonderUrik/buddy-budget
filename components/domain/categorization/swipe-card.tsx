"use client";

/**
 * Carta di un esercente nella categorizzazione rapida: nome, importo, categoria proposta e, con la carta in cima,
 * trascinamento a destra per confermare o a sinistra per cambiare. Non decide nulla da sola: chiama le callback.
 */

import * as React from "react";
import { motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { CategoryAvatar } from "@/components/domain/categories";
import { Button } from "@/components/ui/button";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { Checkbox } from "@/components/ui/checkbox";
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
/** Durata della vibrazione leggera quando un gesto va a segno (dove il telefono la supporta). */
const HAPTIC_TICK_MS = 12;

type SwipeZone = "conferma" | "cambia" | "salta";

/** Zona in cui l'azione scatterebbe se si lasciasse la carta adesso (assente se non si è oltre la soglia). */
function zoneFor(dx: number, dy: number, canConfirm: boolean): SwipeZone | null {
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  if (horizontal && dx > SWIPE_COMMIT_DISTANCE && canConfirm) return "conferma";
  if (horizontal && dx < -SWIPE_COMMIT_DISTANCE) return "cambia";
  if (!horizontal && dy < -SWIPE_COMMIT_DISTANCE) return "salta";
  return null;
}

export interface SwipeCardProps {
  group: SuggestionGroup;
  currency: string;
  /** Nome della categoria proposta (assente se la carta non ha proposte). */
  suggestedName?: string;
  /** Icona e colore della categoria proposta. */
  suggestedAppearance?: { icon: CategoryIcon; color: CategoryColor };
  /** Si sta scegliendo un'altra categoria (il foglio è aperto dal chiamante). */
  changing: boolean;
  remember: boolean;
  onRememberChange: (remember: boolean) => void;
  onConfirm: () => void;
  onChange: () => void;
  onSkip: () => void;
}

export function SwipeCard({
  group,
  currency,
  suggestedName,
  suggestedAppearance,
  changing,
  remember,
  onRememberChange,
  onConfirm,
  onChange,
  onSkip,
}: SwipeCardProps) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-MAX_TILT_DEGREES, MAX_TILT_DEGREES]);
  const y = useMotionValue(0);
  const skipOpacity = useTransform(y, [-SWIPE_COMMIT_DISTANCE, -20], [1, 0]);
  const confirmOpacity = useTransform(x, [20, SWIPE_COMMIT_DISTANCE], [0, 1]);
  const changeOpacity = useTransform(x, [-SWIPE_COMMIT_DISTANCE, -20], [1, 0]);
  const [zone, setZone] = React.useState<SwipeZone | null>(null);
  const rememberId = React.useId();
  const isIncome = group.totalAmount > 0;
  const hasSuggestion = Boolean(group.suggestion);
  const updateZone = React.useCallback(() => {
    const next = zoneFor(x.get(), y.get(), hasSuggestion);
    setZone((previous) => {
      if (next && next !== previous) navigator.vibrate?.(HAPTIC_TICK_MS);
      return next;
    });
  }, [x, y, hasSuggestion]);
  useMotionValueEvent(x, "change", updateZone);
  useMotionValueEvent(y, "change", updateZone);
  const descriptions = [...new Set(group.transactionDescriptions)].slice(0, DESCRIPTION_PREVIEW_LIMIT);

  return (
    <div className="relative flex flex-col max-md:flex-1">
    <motion.div
      style={{ x, y, rotate }}
      drag={changing ? false : true}
      dragSnapToOrigin
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        setZone(null);
        const { x: dx, y: dy } = info.offset;
        const horizontal = Math.abs(dx) >= Math.abs(dy);
        let committed = true;
        if (horizontal && dx > SWIPE_COMMIT_DISTANCE && hasSuggestion) onConfirm();
        else if (horizontal && dx < -SWIPE_COMMIT_DISTANCE) onChange();
        else if (!horizontal && dy < -SWIPE_COMMIT_DISTANCE) onSkip();
        else committed = false;
        if (committed) navigator.vibrate?.(HAPTIC_TICK_MS);
      }}
      className={cn("relative flex touch-none flex-col gap-4 rounded-2xl border-2 bg-card transition-colors p-5 shadow-lg select-none max-md:flex-1 max-md:justify-between", zone === "conferma" ? "border-pos" : zone === "cambia" ? "border-neg" : zone === "salta" ? "border-muted-foreground" : "border-border")}
    >
      <motion.span style={{ opacity: confirmOpacity }} className={cn("pointer-events-none absolute top-4 left-4 rounded-md border-2 border-pos px-2 py-0.5 text-sm font-semibold text-pos", zone === "conferma" && "bg-pos text-background")}>
        {zone === "conferma" ? "Lascia: è questa" : "È questa"}
      </motion.span>
      <motion.span style={{ opacity: skipOpacity }} className={cn("pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-md border-2 border-muted-foreground px-2 py-0.5 text-sm font-semibold text-muted-foreground", zone === "salta" && "bg-muted-foreground text-background")}>
        {zone === "salta" ? "Lascia: salta" : "Salta"}
      </motion.span>
      <motion.span style={{ opacity: changeOpacity }} className={cn("pointer-events-none absolute top-4 right-4 rounded-md border-2 border-neg px-2 py-0.5 text-sm font-semibold text-neg", zone === "cambia" && "bg-neg text-background")}>
        {zone === "cambia" ? "Lascia: un'altra" : "Un'altra"}
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
          <Button type="button" variant="outline" className="h-11 w-full" onClick={onChange}>
            Scegli la categoria
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/60 p-4 text-center">
          <p className="text-xs text-muted-foreground">Categoria proposta</p>
          {suggestedAppearance && <CategoryAvatar icon={suggestedAppearance.icon} color={suggestedAppearance.color} size={24} className="size-12" />}
          <p className="font-heading text-lg font-medium text-foreground">{suggestedName}</p>
          {group.suggestion && <SuggestionSourceBadge suggestion={group.suggestion} />}
        </div>
      )}

      <label htmlFor={rememberId} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox id={rememberId} checked={remember} onCheckedChange={(checked) => onRememberChange(checked === true)} />
        Ricorda per questo esercente
      </label>
    </motion.div>
    </div>
  );
}
