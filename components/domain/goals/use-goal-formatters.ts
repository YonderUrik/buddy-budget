"use client";

import * as React from "react";
import { localizedFormats } from "@/lib/localization/format";
import { useLocalization } from "@/lib/localization/provider";
import { goalFormatters, type GoalFormatters } from "./goal-format";

/** Formattatori degli obiettivi per la lingua dell'utente e la valuta indicata. */
export function useGoalFormatters(currency: string): GoalFormatters {
  const { locale } = useLocalization();
  return React.useMemo(() => goalFormatters(locale, localizedFormats(locale).formatCurrency, currency), [locale, currency]);
}
