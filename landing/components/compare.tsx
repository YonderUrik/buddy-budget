import "./compare.css";
import { Check, Minus, X } from "lucide-react";
import { COMPARE, type CompareValue } from "@/content/home";
import { Reveal } from "./reveal";
import { TrackedSection } from "./tracked-section";

const VALUE_LABEL: Record<CompareValue, string> = { si: "Sì", no: "No", parziale: "In parte" };

function Mark({ value }: { value: CompareValue }) {
  const Icon = value === "si" ? Check : value === "no" ? X : Minus;
  return (
    <span className={`cmp-mark v-${value}`}>
      <Icon aria-hidden="true" size={16} strokeWidth={2.25} />
      <span className="sr">{VALUE_LABEL[value]}</span>
    </span>
  );
}

/**
 * Confronto con le alternative più comuni (foglio di calcolo, app di sole spese), senza marchi altrui. È una vera
 * tabella HTML: si legge senza JS e la capiscono motori di ricerca e assistenti AI. Su telefono ogni riga diventa una scheda.
 */
export function Compare({ content = COMPARE }: { content?: typeof COMPARE }) {
  return (
    <TrackedSection id="confronto" section="confronto" className="sec compare band">
      <div className="wrap">
        <h2 className="t">{content.title}</h2>
        <p className="lede">{content.lede}</p>
        <Reveal className="cmp-wrap">
          <table className="cmp">
            <thead>
              <tr>
                <th scope="col"><span className="sr">Cosa</span></th>
                {content.columns.map((c, i) => (
                  <th key={c} scope="col" className={i === content.columns.length - 1 ? "us" : undefined}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {content.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row">{r.label}</th>
                  {r.cells.map(([value, note], i) => (
                    <td key={i} className={i === r.cells.length - 1 ? "us" : undefined} data-col={content.columns[i]}>
                      <Mark value={value} />
                      {note ? <span className="cmp-note">{note}</span> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
      </div>
    </TrackedSection>
  );
}
