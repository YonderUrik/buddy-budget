import "./viz.css";
import type { Locale } from "@/lib/i18n";

/** Barra a segmenti (es. imposta evitata / dovuta) con legenda: i segmenti si ridimensionano in modo fluido al variare dei dati. */
export function SplitBar({ parts }: { parts: readonly { label: string; value: number; tone: "pos" | "acc" | "neg" | "mut" }[] }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <div className="split">
      <div className="split-bar" role="img" aria-label={parts.map((p) => `${p.label}: ${Math.round(p.value)}`).join(", ")}>
        {parts.map((p) => (
          <span key={p.label} className={`split-seg tone-${p.tone}`} style={{ flexGrow: total > 0 ? Math.max(0, p.value) : 1 }} />
        ))}
      </div>
      <div className="split-legend">
        {parts.map((p) => (
          <span key={p.label}><i className={`dot tone-${p.tone}`} />{p.label}</span>
        ))}
      </div>
    </div>
  );
}

/** Words under the years of `YearsStrip`, in each language. */
const YEARS_STRIP_TEXT: Record<Locale, { born: string; usable: string; last: string }> = {
  it: { born: "perdita", usable: "utilizzabile", last: "ultimo anno" },
  en: { born: "loss", usable: "usable", last: "last year" },
};

/** The years a capital loss can be used, as a strip of labels: the loss is made, then expires after 4 years. */
export function YearsStrip({ from, label, locale = "it" }: { from: number; label: string; locale?: Locale }) {
  const years = Array.from({ length: 5 }, (_, i) => from + i);
  const t = YEARS_STRIP_TEXT[locale];
  return (
    <ol className="years" aria-label={label}>
      {years.map((y, i) => (
        <li key={y} className={i === 0 ? "born" : i === 4 ? "last" : ""}>
          <b>{y}</b>
          <span>{i === 0 ? t.born : i === 4 ? t.last : t.usable}</span>
        </li>
      ))}
    </ol>
  );
}
