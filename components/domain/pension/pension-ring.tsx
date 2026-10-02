/**
 * Anello che mostra di cosa è fatto il fondo: contributi (colore primario) e rendimento (verde), con il controvalore al
 * centro. Se il fondo vale meno di quanto versato, l'anello mostra la parte recuperata e il resto in rosso.
 */

import { money } from "./pension-format";

export interface PensionRingProps {
  value: number;
  netContributions: number;
  currency: string;
  /** Lato del disegno in px. */
  size?: number;
}

const RING_STROKE = 16;
const RING_GAP_PX = 3;

export function PensionRing({ value, netContributions, currency, size = 184 }: PensionRingProps) {
  const radius = (size - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = Math.max(value, netContributions, 1);
  const contributionShare = Math.min(value, netContributions) / total;
  const gainShare = Math.max(0, value - netContributions) / total;
  const lossShare = Math.max(0, netContributions - value) / total;
  const segments = [
    { share: contributionShare, className: "stroke-primary" },
    { share: gainShare, className: "stroke-pos" },
    { share: lossShare, className: "stroke-neg" },
  ];
  let offset = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`Contributi ${money(netContributions, currency)}, controvalore ${money(value, currency)}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={RING_STROKE} className="stroke-muted" />
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {segments.map((segment) => {
            if (segment.share <= 0) return null;
            const length = Math.max(0, segment.share * circumference - RING_GAP_PX);
            const circle = (
              <circle
                key={segment.className}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
                className={`${segment.className} motion-safe:transition-[stroke-dasharray] motion-safe:duration-700`}
              />
            );
            offset += segment.share * circumference;
            return circle;
          })}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-xs text-muted-foreground">Controvalore</span>
        <span className="font-heading text-2xl font-medium tabular-nums text-foreground">{money(value, currency)}</span>
      </div>
    </div>
  );
}
