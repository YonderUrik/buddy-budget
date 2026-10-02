import "./viz.css";
import { buildFrenchPlan } from "@/lib/tools/ammortamento";

/**
 * Mini-visual SVG usati nelle card e nelle pagine di contenuto. Sono funzioni pure dei dati: nessuno stato, nessun hook
 * (si possono usare in pagine server). L'animazione è solo CSS (`viz.css`), parte quando entrano in vista e si ferma con
 * `prefers-reduced-motion`.
 */

const W = 240;
const H = 120;

/** Perdite del 2023 e 2025 che si svuotano dentro la plusvalenza del 2026. */
export function ZainettoViz() {
  return (
    <svg className="viz" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Due minusvalenze compensano una plusvalenza">
      <rect className="viz-bar viz-neg" x="18" y="28" width="46" height="70" rx="8" style={{ ["--d" as string]: "0s" }} />
      <rect className="viz-bar viz-neg" x="76" y="48" width="46" height="50" rx="8" style={{ ["--d" as string]: "0.15s" }} />
      <path className="viz-flow" d="M64 63 C 90 40, 140 40, 156 50 M122 73 C 140 70, 150 66, 156 62" />
      <rect className="viz-bar viz-pos" x="156" y="18" width="62" height="80" rx="8" style={{ ["--d" as string]: "0.3s" }} />
      <rect className="viz-bar viz-fill" x="156" y="58" width="62" height="40" rx="8" style={{ ["--d" as string]: "0.6s" }} />
      <text x="18" y="114" className="viz-t">2023</text><text x="76" y="114" className="viz-t">2025</text><text x="162" y="114" className="viz-t">2026</text>
    </svg>
  );
}

/** Quote di capitale e interessi per ogni anno di un mutuo: gli interessi pesano all'inizio. */
export function AmortViz() {
  const plan = buildFrenchPlan(100000, 3, 240);
  const years = Array.from({ length: 20 }, (_, y) => {
    const rows = plan.rows.slice(y * 12, y * 12 + 12);
    return { interest: rows.reduce((s, r) => s + r.interest, 0), principal: rows.reduce((s, r) => s + r.principal, 0) };
  });
  const max = years[0].interest + years[0].principal;
  const bw = 8;
  return (
    <svg className="viz" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Piano di ammortamento: la quota di interessi cala nel tempo">
      {years.map((y, i) => {
        const ph = (y.principal / max) * 90;
        const ih = (y.interest / max) * 90;
        return (
          <g key={i} className="viz-col" style={{ ["--d" as string]: `${i * 0.04}s` }}>
            <rect x={14 + i * 11} y={100 - ph} width={bw} height={ph} rx="2" className="viz-pos" />
            <rect x={14 + i * 11} y={100 - ph - ih} width={bw} height={ih} rx="2" className="viz-neg" />
          </g>
        );
      })}
      <text x="14" y="116" className="viz-t">anno 1</text><text x="190" y="116" className="viz-t">anno 20</text>
    </svg>
  );
}

/** Linea del tempo di 5 anni: una perdita del 2023 vale fino al 2027. */
export function TimelineViz() {
  const years = [2023, 2024, 2025, 2026, 2027];
  return (
    <svg className="viz" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Una minusvalenza del 2023 si può usare fino al 2027">
      <line x1="20" y1="62" x2="220" y2="62" className="viz-axis" />
      <rect className="viz-span" x="24" y="48" width="192" height="28" rx="14" />
      {years.map((y, i) => (
        <g key={y}>
          <circle cx={30 + i * 45} cy="62" r={i === 0 ? 8 : 5} className={i === 0 ? "viz-neg" : "viz-dot"} style={{ ["--d" as string]: `${i * 0.12}s` }} />
          <text x={30 + i * 45} y="100" className="viz-t" textAnchor="middle">{y}</text>
        </g>
      ))}
      <text x="30" y="34" className="viz-t" textAnchor="middle">perdita</text>
      <text x="210" y="34" className="viz-t" textAnchor="middle">scade</text>
    </svg>
  );
}

/** Andamento di un portafoglio: linea che si disegna e area sotto. */
export function SparkViz() {
  const pts = [92, 86, 88, 74, 78, 64, 68, 52, 56, 40, 44, 30];
  const d = pts.map((p, i) => `${i ? "L" : "M"}${16 + i * 19} ${p}`).join(" ");
  return (
    <svg className="viz" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Andamento crescente di un portafoglio">
      <path className="viz-area" d={`${d} L 225 104 L 16 104 Z`} />
      <path className="viz-line" d={d} pathLength={1} />
      <circle className="viz-end" cx="225" cy="30" r="5" />
    </svg>
  );
}

/** Barra a due segmenti (es. imposta evitata / dovuta) con legenda: cresce in modo fluido al variare dei dati. */
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

/** Andamento del debito residuo: area con un punto ogni anno, ricalcolata sul piano mostrato. */
export function BalanceViz({ balances }: { balances: readonly number[] }) {
  if (balances.length < 2) return null;
  const max = balances[0] || 1;
  const step = 220 / (balances.length - 1);
  const d = balances.map((b, i) => `${i ? "L" : "M"}${10 + i * step} ${100 - (b / max) * 84}`).join(" ");
  return (
    <svg className="viz viz-wide" viewBox="0 0 240 110" role="img" aria-label="Debito residuo nel tempo" preserveAspectRatio="none">
      <path className="viz-area" d={`${d} L ${10 + (balances.length - 1) * step} 100 L 10 100 Z`} />
      <path className="viz-line" d={d} pathLength={1} />
    </svg>
  );
}
