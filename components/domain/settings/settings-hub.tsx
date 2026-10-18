"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * SettingsHub — impaginazione della pagina Impostazioni a gruppi.
 * Desktop: indice fisso a sinistra e un gruppo alla volta. Mobile: prima un elenco dei gruppi (icona, nome, spiegazione),
 * poi il gruppo scelto con la freccia per tornare. Il gruppo corrente sta in `?sezione=`, così «indietro» funziona.
 */

import * as React from "react";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { SECTION_TITLE } from "@/components/domain/shared";
import { SETTINGS_GROUPS, type SettingsGroupId, type SettingsGroupInfo } from "./settings-groups";

export interface SettingsHubProps {
  /** Gruppo scelto; `null` = nessuno (su mobile l'elenco, su desktop il primo). */
  selected: SettingsGroupId | null;
  onSelect: (id: SettingsGroupId | null) => void;
  /** Contenuto di ogni gruppo. */
  content: Record<SettingsGroupId, React.ReactNode>;
  groups?: readonly SettingsGroupInfo[];
}

export function SettingsHub({ selected, onSelect, content, groups = SETTINGS_GROUPS }: SettingsHubProps) {
  const { t: tr } = useLocalization();
  const current = selected ?? groups[0].id;
  const currentGroup = groups.find((g) => g.id === current) ?? groups[0];

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start md:gap-8">
      {/* Elenco mobile */}
      {selected === null ? (
        <ul className="flex flex-col md:hidden">
          {groups.map((group) => (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => onSelect(group.id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-1 py-3 text-left transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn(SECTION_TITLE, "block text-[1.875rem]", group.danger && "text-neg")}>{tr(group.label)}</span>
                  <span className="block text-sm leading-snug text-text-2">{tr(group.summary)}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Indice desktop */}
      <nav aria-label={tr("Gruppi di impostazioni")} className="sticky top-6 hidden w-56 shrink-0 flex-col gap-1 md:flex">
        {groups.map((group) => {
          const active = group.id === current;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => onSelect(group.id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-10 items-center rounded-full px-4 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-muted"
              )}
            >
              <span className={cn("text-[15px] font-medium", active ? "text-foreground" : "text-text-2", group.danger && "text-neg")}>{tr(group.label)}</span>
            </button>
          );
        })}
      </nav>

      {/* Contenuto del gruppo */}
      <div className={cn("min-w-0 flex-1", selected === null && "max-md:hidden")}>
        <h2 className={cn(SECTION_TITLE, "mb-1", currentGroup.danger && "text-neg")}>{tr(currentGroup.label)}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{tr(currentGroup.summary)}</p>
        <div className="flex flex-col gap-8">{content[current]}</div>
      </div>
    </div>
  );
}
