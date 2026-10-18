import "./guide-example.css";
import { eur, money } from "@/lib/format";
import type { Locale } from "@/lib/i18n";
import { computeZainetto } from "@/lib/tools/zainetto";

const LOSSES = [{ year: 2023, amount: 1500 }, { year: 2025, amount: 2000 }];
const GAIN = 3000;
const TAX_YEAR = 2026;

/** Visible texts of the example in one language. */
const TEXT: Record<Locale, { steps: readonly [string, string, string]; compensated: string; tax: string; saved: string; remaining: string; amount: (n: number) => string }> = {
  it: { steps: ["Vendi in perdita", "Ancora in perdita", "Realizzi un guadagno"], compensated: "Compensi", tax: "Imposta dovuta", saved: "Imposta evitata", remaining: "Ti restano (fino al 2029)", amount: eur },
  en: { steps: ["You sell at a loss", "Another loss", "You make a gain"], compensated: "You offset", tax: "Tax due", saved: "Tax avoided", remaining: "Left (until 2029)", amount: (n) => money(n, "en") },
};

/** Worked example of the zainetto guide: two losses, one gain and the result, as a short story in steps. */
export function GuideExample({ locale = "it" }: { locale?: Locale }) {
  const t = TEXT[locale];
  const fmt = t.amount;
  const r = computeZainetto({ taxYear: TAX_YEAR, gain: GAIN, instrument: "azioni_etf", losses: LOSSES });
  return (
    <div className="gx">
      <ol className="gx-steps">
        <li><span className="gx-n">1</span><b>2023</b><em className="neg">−{fmt(1500)}</em><span>{t.steps[0]}</span></li>
        <li><span className="gx-n">2</span><b>2025</b><em className="neg">−{fmt(2000)}</em><span>{t.steps[1]}</span></li>
        <li><span className="gx-n">3</span><b>2026</b><em className="pos">+{fmt(GAIN)}</em><span>{t.steps[2]}</span></li>
      </ol>
      <div className="gx-result">
        <div><small>{t.compensated}</small><b>{fmt(r.compensated)}</b></div>
        <div><small>{t.tax}</small><b>{fmt(r.tax)}</b></div>
        <div className="hi"><small>{t.saved}</small><b>{fmt(r.taxSaved)}</b></div>
        <div><small>{t.remaining}</small><b>{fmt(r.remaining)}</b></div>
      </div>
    </div>
  );
}
