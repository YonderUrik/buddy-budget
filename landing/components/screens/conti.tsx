import { DEMO_RAW_TO_CLEAN } from "@/content/demo";
import { ComparisonChart } from "./charts";

/** Schermata Conti: conti collegati, liquidità e movimenti appena arrivati (testo grezzo → nome pulito). */
export function ContiScreen({ className = "scr" }: { className?: string }) {
  return (
    <div className={className}>
      <div className="ph">
        <h4>Conti</h4>
        <p>Aggiornati 3 minuti fa</p>
      </div>
      <div className="g2">
        <div className="card">
          <div className="lab">Conti collegati</div>
          <div className="rw">
            <span className="d" style={{ background: "var(--a-liq)" }} />
            <div><b>Conto corrente</b><small>Banca collegata · sola lettura</small></div>
            <span className="v">11.916 €</span>
          </div>
          <div className="rw">
            <span className="d" style={{ background: "var(--a-t3)" }} />
            <div><b>Contanti</b><small>Conto manuale</small></div>
            <span className="v">2.500 €</span>
          </div>
        </div>
        <div className="card">
          <div className="lab">Liquidità · 30 giorni</div>
          <div className="mini">14.416 €</div>
          <div style={{ marginTop: 6 }}>
            <ComparisonChart width={300} height={60} seed={9} />
          </div>
        </div>
      </div>
      <div className="card" style={{ flex: 1 }}>
        <div className="lab">Appena arrivati dalla banca</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: "8px 14px", alignItems: "center", marginTop: 10 }}>
          {DEMO_RAW_TO_CLEAN.map((r) => (
            <RawRow key={r.raw} {...r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RawRow({ raw, name, category, token }: (typeof DEMO_RAW_TO_CLEAN)[number]) {
  return (
    <>
      <span className="raw">{raw}</span>
      <span style={{ color: "var(--a-t3)" }}>→</span>
      <span>
        <b style={{ fontWeight: 600 }}>{name}</b>{" "}
        <span className="badge" style={{ background: `color-mix(in srgb, var(${token}) 16%, transparent)`, color: `var(${token})` }}>
          {category}
        </span>
      </span>
    </>
  );
}
