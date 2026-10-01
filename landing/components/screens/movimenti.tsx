import { DEMO_GROUPS, DEMO_LIST } from "@/content/demo";

/** Schermata Movimenti: gruppi di spesa, budget di una categoria e elenco categorizzato. */
export function MovimentiScreen({ className = "scr" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="ph">
        <h4>Movimenti</h4>
        <p>Settembre 2026</p>
      </div>
      <div className="tabs">
        <span className="on">Elenco</span>
        <span>Analisi</span>
        <span>Categorie</span>
        <span>Regole</span>
      </div>
      <div className="g2">
        <div className="card">
          <div className="lab">Dove sono andati i soldi</div>
          <div className="gbar">
            {DEMO_GROUPS.map((g) => (
              <i key={g.label} className="grow" style={{ width: `${g.share}%`, background: `var(${g.token})` }} />
            ))}
          </div>
          <div className="leg">
            {DEMO_GROUPS.slice(0, 3).map((g) => (
              <span key={g.label}><i style={{ background: `var(${g.token})` }} />{g.label} <b>{g.amount}</b></span>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="lab">Budget Ristoranti</div>
          <div className="mini">
            82 € <span style={{ font: "500 12px var(--f-b)", color: "var(--a-t3)" }}>su 120 €</span>
          </div>
          <div className="pb"><i className="grow" style={{ width: "68%", background: "var(--a-primary)" }} /></div>
        </div>
      </div>
      <div className="card" style={{ flex: 1, overflow: "hidden" }}>
        {DEMO_LIST.map((t) => (
          <div className="tx" key={t.raw}>
            <div className="ic" style={{ background: `color-mix(in srgb, var(${t.token}) 16%, transparent)`, color: `var(${t.token})` }}>
              {t.initials}
            </div>
            <div><b>{t.name}</b><small>{t.raw}</small></div>
            <div className={`am${t.positive ? " pos" : ""}`}>
              {t.amount} €<small style={{ color: `var(${t.token})` }}>{t.category}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
