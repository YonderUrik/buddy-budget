/** Schermata Debiti: finanziamento con avanzamento e confronto di un'estinzione anticipata. */
export function DebitiScreen({ className = "scr" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="ph">
        <h4>Debiti</h4>
        <p>Finanziamenti, rate e costo degli interessi</p>
      </div>
      <div className="tabs">
        <span>Panoramica</span>
        <span className="on">Finanziamenti</span>
        <span>Lombard</span>
        <span>Simulatore</span>
      </div>
      <div className="card">
        <div className="between">
          <div>
            <div className="lab">Prestito auto</div>
            <div className="big">18.200 €</div>
            <div className="delta">rata 410 € · finisci a ottobre 2028</div>
          </div>
          <span className="badge">TAEG 6,1%</span>
        </div>
        <div className="pb" style={{ height: 9, marginTop: 12 }}>
          <i className="grow" style={{ width: "41%", background: "var(--a-primary)" }} />
        </div>
        <div className="delta">Hai restituito il 41% del capitale</div>
      </div>
      <div className="card">
        <div className="lab">Estinzione anticipata di 5.000 €</div>
        <div className="cmp" style={{ marginTop: 8 }}>
          <div>
            <b>Riduci la rata</b>
            <div className="kvl"><span>Nuova rata</span><span>297 €</span></div>
            <div className="kvl"><span>Interessi risparmiati</span><span>1.020 €</span></div>
          </div>
          <div>
            <b>Riduci la durata</b>
            <div className="kvl"><span>Finisci prima di</span><span>14 mesi</span></div>
            <div className="kvl"><span>Interessi risparmiati</span><span>1.640 €</span></div>
          </div>
        </div>
        <div className="ok" style={{ marginTop: 10 }}>Conviene ridurre la durata: risparmi 620 € in più, al netto della penale.</div>
      </div>
    </div>
  );
}
