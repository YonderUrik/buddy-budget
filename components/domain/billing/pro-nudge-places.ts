import type { ProNudgePlaceEvent } from "@/lib/analytics";

/** Places outside the plans page that invite a Free account to Pro (the `da` of the plans page, the `place` of the events). */
export const PRO_NUDGE_PLACES = ["sidebar", "menu", "conti", "analisi", "impostazioni"] as const satisfies readonly ProNudgePlaceEvent[];
export type ProNudgePlace = (typeof PRO_NUDGE_PLACES)[number];

/** The `place` in a plans page `da`, or null. */
export function parseProNudgePlace(value: string | null | undefined): ProNudgePlace | null {
  return PRO_NUDGE_PLACES.find((place) => place === value) ?? null;
}
