/**
 * Matrice delle correlazioni tra posizioni: caselle colorate da −1 (si muovono in direzioni opposte) a 1 (si muovono
 * insieme), con il valore scritto. Le posizioni sono numerate e la legenda ne dà il nome.
 */

import type { CorrelationMatrix as Matrix } from "@/lib/calc/risk";
import type { Instrument } from "@/lib/db/schema/investments";

/** Colore di una correlazione: rosso per le coppie che si muovono insieme (meno diversificazione), verde per le opposte. */
export function correlationColor(value: number | null): string {
  if (value === null) return "var(--muted)";
  const strength = Math.round(Math.min(1, Math.abs(value)) * 70);
  return `color-mix(in oklab, ${value >= 0 ? "var(--neg)" : "var(--pos)"} ${strength}%, var(--muted))`;
}

function format(value: number | null): string {
  return value === null ? "—" : value.toFixed(2).replace(".", ",");
}

export interface CorrelationMatrixProps {
  matrix: Matrix;
  instrumentsById: Map<string, Instrument>;
}

export function CorrelationMatrix({ matrix, instrumentsById }: CorrelationMatrixProps) {
  const names = matrix.instrumentIds.map((id) => instrumentsById.get(id)?.name ?? "—");
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs tabular-nums">
          <thead>
            <tr>
              <th className="w-6" />
              {names.map((name, i) => (
                <th key={matrix.instrumentIds[i]} scope="col" className="w-11 font-medium text-muted-foreground" title={name}>
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.values.map((row, i) => (
              <tr key={matrix.instrumentIds[i]}>
                <th scope="row" className="pr-1 text-right font-medium text-muted-foreground" title={names[i]}>
                  {i + 1}
                </th>
                {row.map((value, j) => (
                  <td
                    key={matrix.instrumentIds[j]}
                    className="h-9 w-11 rounded text-center text-foreground"
                    style={{ backgroundColor: i === j ? "transparent" : correlationColor(value) }}
                    aria-label={`${names[i]} e ${names[j]}: ${format(value)}`}
                  >
                    {i === j ? "" : format(value)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ol className="grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
        {names.map((name, i) => (
          <li key={matrix.instrumentIds[i]} className="truncate">
            <span className="tabular-nums text-foreground">{i + 1}.</span> {name}
          </li>
        ))}
      </ol>
    </div>
  );
}
