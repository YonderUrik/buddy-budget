export interface FactTableRow {
  label: string;
  text: string;
}

/** Tabella a due colonne (voce, spiegazione) nello stile del foglio, per le sezioni della pagina Sicurezza. */
export function FactTable({ rows, caption }: { rows: readonly FactTableRow[]; caption: string }) {
  return (
    <div className="sp-table sp-facts cell">
      <table>
        <caption className="sr">{caption}</caption>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>{row.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
