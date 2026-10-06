/** Anello di avanzamento con un'etichetta al centro (es. "26%" e "restituito"). Solo SVG, colori dai token del tema. */

export interface DebtRingProps {
  /** Quota completata, 0-1. */
  fraction: number;
  /** Testo grande al centro. */
  label: string;
  /** Testo piccolo sotto l'etichetta. */
  caption: string;
  size?: number;
}

const RING_STROKE = 12;
const DEFAULT_RING_SIZE = 112;

export function DebtRing({ fraction, label, caption, size = DEFAULT_RING_SIZE }: DebtRingProps) {
  const radius = size / 2 - RING_STROKE / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, fraction));
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} ${caption}`} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={RING_STROKE} className="stroke-muted" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={RING_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${circumference * clamped} ${circumference}`}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        className="stroke-primary"
      />
      <text x="50%" y="47%" textAnchor="middle" className="fill-foreground font-heading" fontSize={size * 0.2}>
        {label}
      </text>
      <text x="50%" y="63%" textAnchor="middle" className="fill-muted-foreground" fontSize={size * 0.105}>
        {caption}
      </text>
    </svg>
  );
}
