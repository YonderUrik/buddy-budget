import { t as trLanding } from "@/lib/localization";
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
        <li><span className="gx-n">1</span><b>2023</b><em className="neg">−{trLanding(eur(1500))}</em><span>{trLanding("Vendi in perdita")}</span></li>
        <li><span className="gx-n">2</span><b>2025</b><em className="neg">−{trLanding(eur(2000))}</em><span>{trLanding("Ancora in perdita")}</span></li>
        <li><span className="gx-n">3</span><b>2026</b><em className="pos">+{trLanding(eur(GAIN))}</em><span>{trLanding("Realizzi un guadagno")}</span></li>
      </ol>
      <div className="gx-result">
        <div><small>{trLanding("Compensi")}</small><b>{trLanding(eur(r.compensated))}</b></div>
        <div><small>{trLanding("Imposta dovuta")}</small><b>{trLanding(eur(r.tax))}</b></div>
        <div className="hi"><small>{trLanding("Imposta evitata")}</small><b>{trLanding(eur(r.taxSaved))}</b></div>
        <div><small>{trLanding("Ti restano (fino al 2029)")}</small><b>{trLanding(eur(r.remaining))}</b></div>
      </div>
    </div>
  );
}
