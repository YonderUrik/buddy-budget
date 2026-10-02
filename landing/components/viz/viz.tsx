import "./viz.css";

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

/** Anni di validità di una minusvalenza come una striscia di etichette: la perdita nasce, poi scade dopo 4 anni. */
export function YearsStrip({ from, label }: { from: number; label: string }) {
  const years = Array.from({ length: 5 }, (_, i) => from + i);
  return (
    <ol className="years" aria-label={label}>
      {years.map((y, i) => (
        <li key={y} className={i === 0 ? "born" : i === 4 ? "last" : ""}>
          <b>{y}</b>
          <span>{i === 0 ? "perdita" : i === 4 ? "ultimo anno" : "utilizzabile"}</span>
        </li>
      ))}
    </ol>
  );
}
