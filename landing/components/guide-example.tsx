import "./guide-example.css";
import { eur } from "@/lib/format";
import { computeZainetto } from "@/lib/tools/zainetto";

const LOSSES = [{ year: 2023, amount: 1500 }, { year: 2025, amount: 2000 }];
const GAIN = 3000;
const TAX_YEAR = 2026;

/** Esempio numerico della guida: due perdite, una plusvalenza e il risultato, come una piccola storia a passi. */
export function GuideExample() {
  const r = computeZainetto({ taxYear: TAX_YEAR, gain: GAIN, instrument: "azioni_etf", losses: LOSSES });
  return (
    <div className="gx">
      <ol className="gx-steps">
        <li><span className="gx-n">1</span><b>2023</b><em className="neg">−{eur(1500)}</em><span>Vendi in perdita</span></li>
        <li><span className="gx-n">2</span><b>2025</b><em className="neg">−{eur(2000)}</em><span>Ancora in perdita</span></li>
        <li><span className="gx-n">3</span><b>2026</b><em className="pos">+{eur(GAIN)}</em><span>Realizzi un guadagno</span></li>
      </ol>
      <div className="gx-result">
        <div><small>Compensi</small><b>{eur(r.compensated)}</b></div>
        <div><small>Imposta dovuta</small><b>{eur(r.tax)}</b></div>
        <div className="hi"><small>Imposta evitata</small><b>{eur(r.taxSaved)}</b></div>
        <div><small>Ti restano (fino al 2029)</small><b>{eur(r.remaining)}</b></div>
      </div>
    </div>
  );
}
