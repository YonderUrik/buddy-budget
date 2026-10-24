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

export interface YearBar {
  label: string;
  /** Two stacked parts, bottom first (e.g. principal, interest). */
  parts: readonly [number, number];
}

/**
 * Stacked bars, one per period, drawn as an SVG with a text equivalent (`title`, `aria-label`): `description` says in
 * words what the bars show, since the image alone tells nothing to a screen reader or a crawler.
 */
export function StackedBars({ bars, legend, description }: { bars: readonly YearBar[]; legend: readonly [string, string]; description: string }) {
  const W = 640;
  const H = 180;
  const max = Math.max(1, ...bars.map((b) => b.parts[0] + b.parts[1]));
  const step = W / Math.max(1, bars.length);
  const gap = Math.min(4, step * 0.25);
  const y = (v: number) => (v / max) * (H - 4);
  return (
    <figure className="bars">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={description} preserveAspectRatio="none">
        <title>{description}</title>
        {bars.map((b, i) => {
          const low = y(b.parts[0]);
          const high = y(b.parts[1]);
          return (
            <g key={b.label}>
              <rect className="tone-pos-fill" x={i * step + gap / 2} y={H - low} width={step - gap} height={low} />
              <rect className="tone-neg-fill" x={i * step + gap / 2} y={H - low - high} width={step - gap} height={high} />
            </g>
          );
        })}
      </svg>
      <figcaption className="bars-axis">
        <span>{bars[0]?.label}</span>
        <span className="split-legend">
          <span><i className="dot tone-pos" />{legend[0]}</span>
          <span><i className="dot tone-neg" />{legend[1]}</span>
        </span>
        <span>{bars.at(-1)?.label}</span>
      </figcaption>
    </figure>
  );
}

export interface FlowStep {
  label: string;
  role: string;
}

/**
 * A path of steps joined by what travels between them, as an SVG: in a row on wide screens, in a column on the phone
 * (two drawings, one shown by CSS). `description` is the same path in words, for screen readers and crawlers.
 */
export function FlowDiagram({ steps, links, description }: { steps: readonly FlowStep[]; links: readonly string[]; description: string }) {
  const n = steps.length;
  const row = { W: 1100, H: 150, box: 236 };
  const gapX = (row.W - n * row.box) / Math.max(1, n - 1);
  const col = { W: 360, H: n * 76 + (n - 1) * 46, boxH: 76 };
  return (
    <figure className="flow">
      <svg className="flow-row" viewBox={`0 0 ${row.W} ${row.H}`} role="img" aria-label={description}>
        <title>{description}</title>
        {steps.map((s, i) => {
          const x = i * (row.box + gapX);
          return (
            <g key={s.label}>
              <rect className="flow-box" x={x} y={20} width={row.box} height={86} rx={20} />
              <text className="flow-label" x={x + row.box / 2} y={58} textAnchor="middle">{s.label}</text>
              <text className="flow-role" x={x + row.box / 2} y={84} textAnchor="middle">{s.role}</text>
              {i < n - 1 ? (
                <g>
                  <line className="flow-line" x1={x + row.box + 8} y1={63} x2={x + row.box + gapX - 14} y2={63} />
                  <path className="flow-head" d={`M ${x + row.box + gapX - 16} 56 l 10 7 l -10 7 z`} />
                  <text className="flow-link" x={x + row.box + gapX / 2} y={138} textAnchor="middle">{links[i]}</text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
      <svg className="flow-col" viewBox={`0 0 ${col.W} ${col.H}`} role="img" aria-label={description}>
        <title>{description}</title>
        {steps.map((s, i) => {
          const y0 = i * (col.boxH + 46);
          return (
            <g key={s.label}>
              <rect className="flow-box" x={0} y={y0} width={col.W} height={col.boxH} rx={18} />
              <text className="flow-label" x={20} y={y0 + 33}>{s.label}</text>
              <text className="flow-role" x={20} y={y0 + 57}>{s.role}</text>
              {i < n - 1 ? (
                <g>
                  <line className="flow-line" x1={36} y1={y0 + col.boxH + 6} x2={36} y2={y0 + col.boxH + 32} />
                  <path className="flow-head" d={`M 29 ${y0 + col.boxH + 30} l 7 10 l 7 -10 z`} />
                  <text className="flow-link" x={56} y={y0 + col.boxH + 28}>{links[i]}</text>
                </g>
              ) : null}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
