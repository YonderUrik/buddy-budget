/**
 * Mappa colore -> classi Tailwind (avatar bg/fg, dot pieno) condivisa da conti e categorie.
 * Estratta da account-avatar.tsx/account-icon-color-picker.tsx per non duplicarla.
 */

import type { SwatchColor } from "@/lib/validation/shared-colors";

export const COLOR_SWATCH_MAP: Record<
  SwatchColor,
  { bg: string; fg: string }
> = {
  slate: {
    bg: "bg-slate-100 dark:bg-slate-800",
    fg: "text-slate-500 dark:text-slate-400",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    fg: "text-blue-600 dark:text-blue-400",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900/40",
    fg: "text-green-600 dark:text-green-400",
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    fg: "text-yellow-600 dark:text-yellow-400",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/40",
    fg: "text-purple-600 dark:text-purple-400",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    fg: "text-orange-600 dark:text-orange-400",
  },
  red: {
    bg: "bg-red-100 dark:bg-red-900/40",
    fg: "text-red-600 dark:text-red-400",
  },
  teal: {
    bg: "bg-teal-100 dark:bg-teal-900/40",
    fg: "text-teal-600 dark:text-teal-400",
  },
};

export const COLOR_DOT: Record<SwatchColor, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-400",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  red: "bg-red-500",
  teal: "bg-teal-500",
};
