import { localizedFormats } from "@/lib/localization/format";

import { LANGUAGE_LOCALES, type Language } from "@/lib/localization/config";

/** Bind presentation text and formatting to one language without shared mutable state. */
export function localizedTitleFormats(language: Language) {
  const locale = LANGUAGE_LOCALES[language];

const { formatPrice, formatCompactAmount, formatRatio } = localizedFormats(locale);
  return { formatPrice, formatCompactAmount, formatRatio };
}

/** Italian defaults retained for existing callers and pure calculation tests. */
export const { formatPrice, formatCompactAmount, formatRatio } = localizedTitleFormats("it");
