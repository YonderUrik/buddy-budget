import { ComparisonChart } from "./charts";

/** Schermata Investimenti: valore, rendimento, imposta se vendi oggi, confronto con un indice e fisco italiano. */
export function InvestimentiScreen({ className = "scr" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="ph">
        <h4>Investimenti</h4>
        <p>Portafoglio e rendimenti</p>
      </div>
      <div className="tabs">
        <span className="on">Panoramica</span>
        <span>Operazioni</span>
        <span>Rendimenti</span>
        <span>Rischio</span>
        <span>Fisco</span>
      </div>
      <div className="g3">
        <div className="card"><div className="lab">Valore</div><div className="mini">39.070 €</div></div>
        <div className="card"><div className="lab">Rendimento (TWR)</div><div className="mini pos">+9,4%</div></div>
        <div className="card">
          <div className="lab">Se vendi oggi</div>
          <div className="mini">−780 €</div>
          <div className="delta" style={{ marginTop: 0 }}>imposta stimata</div>
        </div>
      </div>
      <div className="g2">
        <div className="card">
          <div className="between">
            <div className="lab">Contro un indice globale</div>
            <div className="leg">
              <span><i style={{ background: "var(--a-primary)" }} />Tu</span>
              <span><i style={{ background: "var(--a-t3)" }} />Indice</span>
            </div>
          </div>
          <div style={{ marginTop: 8 }}><ComparisonChart width={480} height={120} seed={5} /></div>
        </div>
        <div className="card">
          <div className="lab">Fisco italiano</div>
          <div className="rw"><div><b>Zaino fiscale</b><small>minusvalenze compensabili</small></div><span className="v">1.240 €</span></div>
          <div className="rw"><div><b>Aliquota</b><small>azioni e ETF</small></div><span className="v">26%</span></div>
          <div className="rw"><div><b>Titoli di Stato</b><small>aliquota agevolata</small></div><span className="v">12,5%</span></div>
        </div>
      </div>
      <div className="card" style={{ flex: 1 }}>
        <div className="rw"><div><b>VWCE</b><small>ETF azionario globale</small></div><span className="v">22.180 €</span></div>
        <div className="rw"><div><b>BTP Valore 2030</b><small>Titolo di Stato</small></div><span className="v">9.400 €</span></div>
      </div>
    </div>
  );
}
