import "./comparison.css";
import { COMPARISON_ROWS, type ComparisonCell } from "@/content/site";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

function Cell({ cell, us }: { cell: ComparisonCell; us?: boolean }) {
  return (
    <td className={us ? "us" : undefined}>
      <span className={`dot ${cell.level}`}>{cell.label}</span>
    </td>
  );
}

/** Confronto per categorie di prodotto: cosa serve davvero e chi lo copre. */
export function Comparison() {
  return (
    <TrackedSection id="confronto" section="confronto" className="sec" >
      <div className="wrap" style={{ paddingTop: 0 }}>
        <div className="kicker">Perché BuddyBudget</div>
        <h2 className="t">Un&apos;app per ogni pezzo. Nessuna per il quadro intero.</h2>
        <Reveal className="cmpw">
          <table>
            <thead>
              <tr>
                <th>Cosa ti serve</th>
                <th>App di budget</th>
                <th>App di investimenti</th>
                <th>Foglio di calcolo</th>
                <th className="us">BuddyBudget</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISON_ROWS.map((r) => (
                <tr key={r.need}>
                  <td>{r.need}</td>
                  <Cell cell={r.budgetApp} />
                  <Cell cell={r.investApp} />
                  <Cell cell={r.sheet} />
                  <Cell cell={r.us} us />
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <p className="fine">Confronto tra categorie di prodotto, non tra singoli nomi.</p>
      </div>
    </TrackedSection>
  );
}
