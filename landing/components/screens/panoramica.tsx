import { NetWorthChart } from "./charts";

/** Schermata Panoramica: patrimonio netto, dove sta il patrimonio, questo mese. `data-count` anima il totale. */
export function PanoramicaScreen({ className = "scr live" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="ph">
        <h4>Panoramica</h4>
        <p>Giovedì 1 ottobre</p>
      </div>
      <div className="card">
        <div className="between">
          <div>
            <div className="lab">Patrimonio netto</div>
            <div className="big">
              <span data-count="47320">47.320</span> €
            </div>
            <div className="delta">
              <span className="pos">+2.140 € (+4,7%)</span> negli ultimi 3 mesi
            </div>
          </div>
          <div className="seg">
            <span>1M</span>
            <span className="on">3M</span>
            <span>1A</span>
            <span>Max</span>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <NetWorthChart />
        </div>
        <div className="leg" style={{ marginTop: 6 }}>
          <span><i style={{ background: "var(--a-liq)" }} />Liquidità</span>
          <span><i style={{ background: "var(--a-inv)" }} />Investimenti</span>
          <span>Linea tratteggiata: patrimonio netto</span>
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="lab">Dove sta il tuo patrimonio</div>
          <div className="rw">
            <span className="d" style={{ background: "var(--a-liq)" }} />
            <div><b>Liquidità</b><small>2 conti</small></div>
            <span className="v">14.416 €</span>
          </div>
          <div className="rw">
            <span className="d" style={{ background: "var(--a-inv)" }} />
            <div><b>Investimenti</b><small>6 titoli</small></div>
            <span className="v">39.070 €</span>
          </div>
          <div className="rw">
            <span className="d" style={{ background: "var(--a-neg)" }} />
            <div><b>Debiti</b><small>1 finanziamento</small></div>
            <span className="v">−18.200 €</span>
          </div>
        </div>
        <div className="card">
          <div className="lab">Questo mese</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            <div className="between"><span>Entrate</span><b className="pos">2.188 €</b></div>
            <div className="between"><span>Uscite</span><b className="neg">1.724 €</b></div>
            <div className="between"><span>Messo da parte</span><b className="pos">464 €</b></div>
          </div>
        </div>
      </div>
    </div>
  );
}
