import * as base from "@/lib/format";
/** Locale is explicit and bound per render, so concurrent users cannot affect each other. */
export function localizedFormats(locale: string) {
  const percent = (value: number, digits = 1) => new Intl.NumberFormat(locale, { style: "percent", minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  return {
    formatPct: percent,
    formatSignedPct: (ratio: number) => `${ratio < 0 ? "−" : "+"}${percent(Math.abs(ratio))}`,
    formatSignedCurrency: (value: number, currency: string) => `${value < 0 ? "−" : "+"}${base.formatCurrency(Math.abs(value), currency, { locale })}`,
    formatPrice: (value: number, currency: string) => base.formatCurrency(value, currency, { locale, maximumFractionDigits: Math.abs(value) < 10 ? 4 : 2 }),
    formatCompactAmount: (value: number) => new Intl.NumberFormat(locale, { notation: "compact", maximumFractionDigits: 1 }).format(value),
    formatRatio: (value: number, digits = 1) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value),
    shortMonthLabel: (month: string | number) => new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, typeof month === "number" ? month - 1 : Number(month.slice(5, 7)) - 1, 1)).replace(".", ""),
    formatMonthLabel: (key: string) => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, 1)),
    formatCurrency: (value: number, currency: string, options: Parameters<typeof base.formatCurrency>[2] = {}) => base.formatCurrency(value, currency, { locale, ...options }),
    getCurrencySymbol: (currency: string, override = locale) => base.getCurrencySymbol(currency, override),
    formatShortDate: (value: string, override = locale) => base.formatShortDate(value, override),
    formatDateWithYear: (value: string, override = locale) => base.formatDateWithYear(value, override),
    formatLongDate: (value: Date, override = locale) => base.formatLongDate(value, override),
    formatRelativeTime: (date: Date, now = new Date()) => {
      const minutes = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 60000));
      const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
      if (minutes < 1) return relative.format(0, "second");
      if (minutes < 60) return relative.format(-minutes, "minute");
      if (minutes < 1440) return relative.format(-Math.floor(minutes / 60), "hour");
      if (minutes < 10080) return relative.format(-Math.floor(minutes / 1440), "day");
      return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(date);
    },
  };
}
