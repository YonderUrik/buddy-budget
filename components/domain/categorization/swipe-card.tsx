"use client";
import { localizedFormats } from "@/lib/localization/format";

import { useLocalization } from "@/lib/localization/provider";

/**
 * Carta di un esercente nella categorizzazione rapida: logo, nome, importo, quando (date e primi movimenti), categoria
 * proposta con la sua origine e, con la carta in cima, trascinamento a destra per confermare o a sinistra per cambiare.
 * Non decide nulla da sola: chiama le callback.
 */

import * as React from "react";
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from "motion/react";
import { CategoryAvatar } from "@/components/domain/categories";
import { Button } from "@/components/ui/button";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { Checkbox } from "@/components/ui/checkbox";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import { localizedCategorizationText } from "@/lib/categorization/origin";

import { cn } from "@/lib/utils";
import { MerchantLogo } from "./merchant-logo";
import { MovementsPreview } from "./movements-preview";
import { SuggestionOrigin } from "./suggestion-origin";

/** Distanza di trascinamento oltre la quale il gesto vale come scelta. */
export const SWIPE_COMMIT_DISTANCE = 110;
/** Inclinazione massima della carta in gradi. */
const MAX_TILT_DEGREES = 8;
/** Ritorno al centro quando il gesto non va a segno. */
const SNAP_BACK_SPRING = { type: "spring", stiffness: 500, damping: 34 } as const;
/** Durata della vibrazione leggera quando un gesto va a segno (dove il telefono la supporta). */
const HAPTIC_TICK_MS = 12;
/** Movimenti mostrati sulla carta su telefono (su schermi larghi `MOVEMENTS_PREVIEW_LIMIT`). */
const MOBILE_PREVIEW_LIMIT = 2;

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
  /** Chiamata quando la carta mostra un logo remoto (per citare la fonte dei loghi). */
  onRemoteLogo?: () => void;
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
  onRemoteLogo,
}: SwipeCardProps) {
  const { dateRangeLabel } = localizedCategorizationText(useLocalization().language);

  const { locale: formattingLocale } = useLocalization();
  const { formatCurrency } = localizedFormats(formattingLocale);

  const { t: tr } = useLocalization();
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
  const count = group.transactionIds.length;

  return (
    <div className="relative flex flex-col max-md:flex-1">
    <motion.div
      style={{ x, y, rotate }}
      drag={changing ? false : true}
      dragElastic={0.6}
      onDragEnd={(_, info) => {
        setZone(null);
        const { x: dx, y: dy } = info.offset;
        const horizontal = Math.abs(dx) >= Math.abs(dy);
        // Confermata o saltata la carta resta dove la si è lasciata e da lì esce (la anima il mazzo); altrimenti torna al centro.
        let leaves = false;
        if (horizontal && dx > SWIPE_COMMIT_DISTANCE && hasSuggestion) { onConfirm(); leaves = true; }
        else if (horizontal && dx < -SWIPE_COMMIT_DISTANCE) { onChange(); navigator.vibrate?.(HAPTIC_TICK_MS); }
        else if (!horizontal && dy < -SWIPE_COMMIT_DISTANCE) { onSkip(); leaves = true; }
        if (leaves) navigator.vibrate?.(HAPTIC_TICK_MS);
        else { animate(x, 0, SNAP_BACK_SPRING); animate(y, 0, SNAP_BACK_SPRING); }
      }}
      className={cn("relative flex touch-none flex-col gap-4 rounded-2xl border-2 bg-card transition-colors p-5 shadow-lg select-none max-md:flex-1 max-md:justify-between", zone === "conferma" ? "border-pos" : zone === "cambia" ? "border-neg" : zone === "salta" ? "border-muted-foreground" : "border-border")}
    >
      <motion.span style={{ opacity: confirmOpacity }} className={cn("pointer-events-none absolute top-4 left-4 rounded-md border-2 border-pos px-2 py-0.5 text-sm font-semibold text-pos", zone === "conferma" && "bg-pos text-background")}>
        {zone === "conferma" ? tr("Lascia: è questa") : tr("È questa")}
      </motion.span>
      <motion.span style={{ opacity: skipOpacity }} className={cn("pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 rounded-md border-2 border-muted-foreground px-2 py-0.5 text-sm font-semibold text-muted-foreground", zone === "salta" && "bg-muted-foreground text-background")}>
        {zone === "salta" ? tr("Lascia: salta") : tr("Salta")}
      </motion.span>
      <motion.span style={{ opacity: changeOpacity }} className={cn("pointer-events-none absolute top-4 right-4 rounded-md border-2 border-neg px-2 py-0.5 text-sm font-semibold text-neg", zone === "cambia" && "bg-neg text-background")}>
        {zone === "cambia" ? tr("Lascia: un'altra") : tr("Un'altra")}
      </motion.span>

      <div className="flex flex-col items-center gap-1 pt-6 text-center">
        <MerchantLogo name={group.label} logoPath={group.logoPath} size="md" onRemoteLogo={onRemoteLogo} className="mb-1 md:size-14 md:text-xl" />
        <p className="font-heading text-xl font-medium break-words text-foreground">{group.label}</p>
        <p className={cn("text-lg font-medium tabular-nums", isIncome ? "text-pos" : "text-foreground")}>
          {formatCurrency(group.totalAmount, currency)}
        </p>
        <p className="text-xs text-muted-foreground">
          {count === 1 ? tr("1 movimento") : tr("{0} movimenti", { 0: count })} {"·"}{dateRangeLabel(group.transactionDates)}
        </p>
      </div>

      {/* Con un movimento solo data e importo sono già sopra; sul telefono bastano i due più recenti. */}
      {count > 1 ? (
        <>
          <MovementsPreview
            label={group.label}
            dates={group.transactionDates}
            amounts={group.transactionAmounts}
            descriptions={group.transactionDescriptions}
            currency={currency}
            className="rounded-xl border border-border px-3 py-2 max-md:hidden"
          />
          <MovementsPreview
            label={group.label}
            dates={group.transactionDates}
            amounts={group.transactionAmounts}
            descriptions={group.transactionDescriptions}
            currency={currency}
            limit={MOBILE_PREVIEW_LIMIT}
            className="rounded-xl border border-border px-3 py-2 md:hidden"
          />
        </>
      ) : null}

      {changing || !hasSuggestion ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">{changing ? tr("Scegli la categoria giusta") : tr("Nessuna proposta: scegli tu la categoria")}</p>
          <Button type="button" variant="outline" className="h-11 w-full" onClick={onChange}>
            {tr("Scegli la categoria")}</Button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-muted/60 p-3 text-center md:p-4">
          <p className="text-xs text-muted-foreground">{tr("Categoria proposta")}</p>
          {suggestedAppearance && <CategoryAvatar icon={suggestedAppearance.icon} color={suggestedAppearance.color} size={22} className="size-10 md:size-12" />}
          <p className="font-heading text-lg font-medium text-foreground">{suggestedName}</p>
          {group.suggestion && <SuggestionOrigin suggestion={group.suggestion} align="center" />}
        </div>
      )}

      <label htmlFor={rememberId} className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
        <Checkbox id={rememberId} checked={remember} onCheckedChange={(checked) => onRememberChange(checked === true)} />
        <span className="min-w-0">
          {tr("Usa sempre questa categoria")}<span className="max-sm:sr-only"> {tr("per «")}{group.label}{"»"}</span>
        </span>
      </label>
    </motion.div>
    </div>
  );
}
