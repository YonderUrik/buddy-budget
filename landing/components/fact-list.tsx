import { t as trLanding } from "@/lib/localization";
export interface FactListRow {
  label: string;
  text: string;
}

/** Elenco voce → spiegazione (`<dl>`), per le risposte a tendina della pagina Sicurezza. */
export function FactList({ rows }: { rows: readonly FactListRow[] }) {
  return (
    <dl className="sp-dl">
      {rows.map((row) => (
        <div key={row.label}>
          <dt>{trLanding(row.label)}</dt>
          <dd>{trLanding(row.text)}</dd>
        </div>
      ))}
    </dl>
  );
}
