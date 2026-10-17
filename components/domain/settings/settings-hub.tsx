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
import { SETTINGS_GROUPS, type SettingsGroupId, type SettingsGroupInfo } from "./settings-groups";

export interface SettingsHubProps {
  /** Gruppo scelto; `null` = nessuno (su mobile l'elenco, su desktop il primo). */
  selected: SettingsGroupId | null;
  onSelect: (id: SettingsGroupId | null) => void;
  /** Contenuto di ogni gruppo. */
  content: Record<SettingsGroupId, React.ReactNode>;
  groups?: readonly SettingsGroupInfo[];
}

function GroupIcon({ group, size = "md" }: { group: SettingsGroupInfo; size?: "sm" | "md" }) {

  const Icon = group.icon;
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-xl",
        size === "md" ? "size-10" : "size-8",
        group.danger ? "bg-neg-soft text-neg" : "bg-primary/10 text-primary"
      )}
    >
      <Icon className={size === "md" ? "size-5" : "size-4"} aria-hidden="true" />
    </span>
  );
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
                className="flex min-h-16 w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-colors active:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <GroupIcon group={group} />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px] font-semibold leading-tight", group.danger && "text-neg")}>{tr(group.label)}</span>
                  <span className="block text-xs leading-snug text-text-2">{tr(group.summary)}</span>
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
                "flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active && "bg-muted"
              )}
            >
              <GroupIcon group={group} size="sm" />
              <span className={cn("text-sm font-medium", group.danger && "text-neg")}>{tr(group.label)}</span>
            </button>
          );
        })}
      </nav>

      {/* Contenuto del gruppo */}
      <div className={cn("min-w-0 flex-1", selected === null && "max-md:hidden")}>
        <h2 className={cn("mb-1 font-heading text-xl font-medium", currentGroup.danger ? "text-neg" : "text-foreground")}>{tr(currentGroup.label)}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{tr(currentGroup.summary)}</p>
        <div className="flex flex-col gap-8">{content[current]}</div>
      </div>
    </div>
  );
}
