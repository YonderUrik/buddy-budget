import { DEMO_GROUPS } from "@/content/demo";

/** Quattro gruppi di spesa di un mese e il budget di una categoria. */
export function BudgetCard() {
  return (
    <div className="vis" aria-hidden="true">
      <div className="lab">Settembre</div>
      <div className="gbar">
        {DEMO_GROUPS.map((g) => (
          <i key={g.label} style={{ width: `${g.share}%`, background: `var(${g.token})` }} />
        ))}
      </div>
      <div className="leg">
        {DEMO_GROUPS.slice(0, 3).map((g) => (
          <span key={g.label}><i style={{ background: `var(${g.token})` }} />{g.label} <b>{g.amount}</b></span>
        ))}
      </div>
      <div className="lab" style={{ marginTop: 14 }}>Ristoranti · 82 € su 120 €</div>
      <div className="pb"><i style={{ width: "68%", background: "var(--a-primary)" }} /></div>
    </div>
  );
}
