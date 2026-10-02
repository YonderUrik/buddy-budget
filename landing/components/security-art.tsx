import type { ReactElement } from "react";
import type { SecurityArtId } from "@/content/site";

/** Numero di stelle della ghirlanda europea. */
const EU_STARS = 12;

/** Raggio (unità del disegno) della ghirlanda di stelle. */
const EU_RADIUS = 34;

const STAR_PATH = "M0-7 2-2.2 7-2.2 3-.2 4.4 5 0 2 -4.4 5 -3-.2 -7-2.2 -2-2.2Z";

function PasswordArt() {
  return (
    <svg viewBox="0 0 200 96" aria-hidden="true">
      <g className="a-dots">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <circle key={i} cx={24 + i * 13} cy={48} r={4.5} style={{ animationDelay: `${i * 0.12}s` }} />
        ))}
        <path className="a-strike" d="M14 70 100 26" pathLength={1} />
      </g>
      <g className="a-mail">
        <rect x="118" y="30" width="62" height="40" rx="8" />
        <path d="M122 36l27 20 27-20" fill="none" />
        <circle className="a-check-bg" cx="176" cy="30" r="10" />
        <path className="a-check" d="M171 30l4 4 7-8" fill="none" pathLength={1} />
      </g>
    </svg>
  );
}

function BankArt() {
  return (
    <svg viewBox="0 0 200 96" aria-hidden="true">
      <g className="a-rows">
        {[0, 1, 2].map((i) => (
          <g key={i} style={{ animationDelay: `${i * 0.5}s` }}>
            <rect x="14" y={16 + i * 24} width="104" height="16" rx="8" />
            <rect className="a-fill" x="22" y={22 + i * 24} width={[48, 70, 36][i]} height="4" rx="2" />
          </g>
        ))}
        <rect className="a-scan" x="14" y="12" width="104" height="72" rx="10" />
      </g>
      <g className="a-lock">
        <rect x="134" y="38" width="52" height="40" rx="9" />
        <path d="M145 38v-8a15 15 0 0 1 30 0v8" fill="none" />
        <circle className="a-keyhole" cx="160" cy="55" r="4.5" />
        <path className="a-keyhole" d="M160 58v9" />
      </g>
    </svg>
  );
}

function EuropeArt() {
  return (
    <svg viewBox="0 0 200 96" aria-hidden="true">
      <g transform="translate(100 48)">
        <g className="a-stars">
          {Array.from({ length: EU_STARS }, (_, i) => {
            const angle = (i / EU_STARS) * Math.PI * 2 - Math.PI / 2;
            return (
              <path
                key={i}
                d={STAR_PATH}
                transform={`translate(${(Math.cos(angle) * EU_RADIUS).toFixed(1)} ${(Math.sin(angle) * EU_RADIUS).toFixed(1)}) scale(0.9)`}
                style={{ animationDelay: `${i * 0.18}s` }}
              />
            );
          })}
        </g>
        <circle className="a-core" r="10" />
      </g>
    </svg>
  );
}

function SellArt() {
  return (
    <svg viewBox="0 0 200 96" aria-hidden="true">
      <g className="a-tag" transform="translate(100 12)">
        <path d="M-34 0h38l30 30-34 34L-34 30Z" transform="translate(4 4)" />
        <circle cx="-22" cy="22" r="4" className="a-hole" />
        <text x="2" y="42" textAnchor="middle" className="a-price">
          €
        </text>
      </g>
      <circle className="a-ban" cx="100" cy="48" r="38" fill="none" pathLength={1} />
      <path className="a-ban" d="M73 75 127 21" pathLength={1} />
    </svg>
  );
}

function LogsArt() {
  const lines = [
    { label: "sessione.aperta", user: "a41f…", w: 0 },
    { label: "movimenti.letti", user: "a41f…", w: 1 },
    { label: "export.scaricato", user: "a41f…", w: 2 },
  ];
  return (
    <svg viewBox="0 0 200 96" aria-hidden="true">
      {lines.map((l, i) => (
        <g key={l.label} className="a-line" style={{ animationDelay: `${i * 0.7}s` }} transform={`translate(10 ${14 + i * 26})`}>
          <rect width="180" height="20" rx="6" className="a-linebg" />
          <text x="10" y="14" className="a-code">
            {l.label}
          </text>
          <text x="112" y="14" className="a-code a-user">
            {l.user}
          </text>
          <rect className="a-redact" x="146" y="5" width={[24, 16, 28][l.w]} height="10" rx="3" />
        </g>
      ))}
    </svg>
  );
}

function ControlArt() {
  return (
    <svg viewBox="0 0 200 96" aria-hidden="true">
      <g transform="translate(14 20)">
        <rect className="a-track" width="46" height="26" rx="13" />
        <circle className="a-knob" cx="13" cy="13" r="9" />
        <text x="58" y="18" className="a-code">
          nascondi
        </text>
      </g>
      <g transform="translate(14 56)">
        <rect className="a-pill" width="52" height="24" rx="12" />
        <text x="26" y="16" textAnchor="middle" className="a-pilltext">
          Scarica
        </text>
        <rect className="a-pill a-pill-2" x="60" width="52" height="24" rx="12" />
        <text x="86" y="16" textAnchor="middle" className="a-pilltext">
          Azzera
        </text>
        <rect className="a-pill a-pill-3" x="120" width="52" height="24" rx="12" />
        <text x="146" y="16" textAnchor="middle" className="a-pilltext">
          Elimina
        </text>
      </g>
      <g className="a-amount" transform="translate(134 38)">
        <text className="a-money">1.234 €</text>
        <text className="a-masked">••••••</text>
      </g>
    </svg>
  );
}

const ARTS: Record<SecurityArtId, () => ReactElement> = {
  password: PasswordArt,
  bank: BankArt,
  europe: EuropeArt,
  sell: SellArt,
  logs: LogsArt,
  control: ControlArt,
};

/** Piccola illustrazione animata di un riquadro della sezione Sicurezza. Le animazioni partono con `.live` sul contenitore. */
export function SecurityArt({ id }: { id: SecurityArtId }) {
  const Art = ARTS[id];
  return (
    <div className={`art art-${id}`}>
      <Art />
    </div>
  );
}
