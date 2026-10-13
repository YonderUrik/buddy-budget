/** Elenco delle importazioni fatte: per origine, con periodo, data di caricamento, dettagli, stato e azione di eliminazione. */

import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatImportDate, type ImportHistoryGroup, type ImportStatusTone } from "./import-history";

export interface ImportHistoryListProps {
  groups: ImportHistoryGroup[];
  /** Eliminazione in verifica: disabilita i pulsanti. */
  busy?: boolean;
  onDelete: (kind: "broker" | "personal", id: string) => void;
}

const TONE_COLOR: Record<ImportStatusTone, string> = {
  ok: "var(--pos)",
  warning: "var(--swatch-amber)",
  error: "var(--destructive)",
  pending: "var(--swatch-indigo)",
};

export function ImportHistoryList({ groups, busy = false, onDelete }: ImportHistoryListProps) {
  return (
    <div className="flex flex-col gap-5" aria-label="Importazioni fatte">
      {groups.map((group) => (
        <section key={group.source} aria-label={group.source} className="flex flex-col">
          <h3 className="text-sm font-semibold text-foreground">{group.source}</h3>
          <ul className="flex flex-col divide-y">
            {group.items.map((item) => {
              const color = TONE_COLOR[item.status.tone];
              const label = `${item.source}${item.period ? `, ${item.period}` : ""}, caricato il ${formatImportDate(item.createdAt)}`;
              return (
                <li key={item.key} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">{item.period ?? "File caricato"}</p>
                    <p className="text-xs text-muted-foreground">
                      Caricato il {formatImportDate(item.createdAt)}
                      {item.details.length > 0 ? ` · ${item.details.join(" · ")}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span className={cn("size-2 rounded-full")} style={{ backgroundColor: color }} aria-hidden="true" />
                      {item.status.label}
                    </span>
                    {item.kind === "personal" ? (
                      <Link href={`/importazioni?job=${item.id}`} className="min-h-11 content-center font-medium text-primary hover:underline" aria-label={`Apri l'importazione: ${label}`}>
                        Apri
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onDelete(item.kind, item.id)}
                      aria-label={`Elimina l'importazione: ${label}`}
                      className="min-h-11 content-center font-medium text-destructive hover:underline disabled:opacity-50"
                    >
                      Elimina
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
