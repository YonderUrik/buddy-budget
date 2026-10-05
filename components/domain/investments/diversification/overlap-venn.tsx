/** Due cerchi che si sovrappongono tanto quanto i due fondi: più sono sovrapposti, più sono lo stesso investimento. */

import type { Severity } from "@/lib/investments/plain-labels";

const RADIUS = 14;
const HEIGHT = RADIUS * 2;
/** Distanza tra i centri con quota 0 e con quota 1 (cerchi coincidenti): sempre un minimo visibile di separazione. */
const MAX_GAP = RADIUS * 2 - 2;
const MIN_GAP = 3;

const TONE: Record<Severity, string> = {
  alta: "var(--swatch-amber)",
  media: "var(--swatch-amber)",
  bassa: "var(--swatch-blue)",
};

export function OverlapVenn({ share, severity }: { share: number; severity: Severity }) {
  const gap = MAX_GAP - (MAX_GAP - MIN_GAP) * Math.min(1, Math.max(0, share));
  const width = RADIUS * 2 + MAX_GAP;
  return (
    <svg viewBox={`0 0 ${width} ${HEIGHT}`} width={width} height={HEIGHT} className="shrink-0" aria-hidden="true">
      <circle cx={RADIUS} cy={RADIUS} r={RADIUS} fill={TONE.bassa} opacity={0.6} />
      <circle cx={RADIUS + gap} cy={RADIUS} r={RADIUS} fill={TONE[severity]} opacity={0.6} />
    </svg>
  );
}
