"use client";

/**
 * Rolling number: when `value` changes, only the changed digits roll, in the direction of the change. Built on
 * NumberFlow (MIT); formats with `Intl.NumberFormat`, so currencies, percentages and years keep their usual options.
 * The roll starts once the page has finished rendering the new data and lasts as long as `SPRING_SOFT`, so it does
 * not stop halfway. With reduced motion the number changes without animation; screen readers read the whole value.
 */

import { useLocalization } from "@/lib/localization/provider";
import { SPRING_SOFT, springEasing } from "@/lib/motion/springs";
import NumberFlow, { type Format } from "@number-flow/react";
import { cn } from "@/lib/utils";
import { useSettledValue } from "./use-settled-value";

export interface AnimatedNumberProps {
  value: number;
  /** `Intl.NumberFormat` options (e.g. `{ style: "currency", currency: "EUR" }`). */
  format?: Format;
  locales?: Intl.LocalesArgument;
  /** Smaller, muted decimals and trailing symbol, as in highlighted amounts. */
  mutedTail?: boolean;
  className?: string;
}

/**
 * Classes that shrink and mute decimals and currency (NumberFlow's `fraction`, `decimal` and `right` parts). NumberFlow
 * fades rolling digits at the edges of the whole number, sized for the big digits: each small decimal gets its own fade,
 * otherwise the digits above and below it stay visible in the empty space next to the integer part while it rolls.
 */
const MUTED_TAIL_CLASS = [
  "[&::part(fraction)]:text-[0.55em] [&::part(fraction)]:text-muted-foreground",
  "[&::part(decimal)]:text-[0.55em] [&::part(decimal)]:text-muted-foreground",
  "[&::part(right)]:text-[0.55em] [&::part(right)]:text-muted-foreground",
  "[&::part(fraction-digit)]:[mask-image:linear-gradient(to_bottom,transparent,black_0.2em,black_calc(100%_-_0.2em),transparent)]", // taste-skill-ignore: an alpha mask that clips rolling digits, not a visible gradient
].join(" ");

/** Roll and width timing: the app's soft spring (about 530 ms) instead of NumberFlow's 900 ms with a long, slow tail. */
const ROLL_TIMING = springEasing(SPRING_SOFT.stiffness, SPRING_SOFT.damping);
/** Fade of digits that appear or disappear (NumberFlow's default is 450 ms). */
const FADE_TIMING = { duration: 250, easing: "ease-out" } as const;

export function AnimatedNumber({
  value,
  format,
  locales,
  mutedTail = false,
  className,
}: AnimatedNumberProps) {
  const { locale } = useLocalization();
  const shown = useSettledValue(value);
  return (
    <NumberFlow
      value={shown}
      format={format}
      locales={locales ?? locale}
      animated
      respectMotionPreference
      transformTiming={ROLL_TIMING}
      spinTiming={ROLL_TIMING}
      opacityTiming={FADE_TIMING}
      className={cn("tabular-nums", mutedTail && MUTED_TAIL_CLASS, className)}
    />
  );
}
