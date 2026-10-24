"use client";

/**
 * Chooser of «Aggiungi»: what can be added, by section, with the section of the current page first. Three layouts:
 * `list` (name and one line each, under the section name), `tiles` (a grid of short names, the section under each) and
 * `search` (a field that filters a compact list, arrows and Enter on the keyboard).
 */

import * as React from "react";
import {
  CreditCardIcon,
  FileSpreadsheetIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  RepeatIcon,
  SearchIcon,
  TargetIcon,
  TrendingUpIcon,
  UmbrellaIcon,
  UploadIcon,
  type LucideIcon,
} from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import type { QuickAddActionId, QuickAddGroup } from "@/lib/quick-add/actions";
import { cn } from "@/lib/utils";

export type QuickAddLayout = "list" | "tiles" | "search";

/** Icon of each action. */
export const QUICK_ADD_ICONS: Record<QuickAddActionId, LucideIcon> = {
  movimento: ReceiptTextIcon,
  conto: LandmarkIcon,
  file: FileSpreadsheetIcon,
  abbonamento: RepeatIcon,
  operazione: TrendingUpIcon,
  rendiconto: UploadIcon,
  debito: CreditCardIcon,
  pensione: UmbrellaIcon,
  obiettivo: TargetIcon,
};

export interface QuickAddChooserProps {
  groups: QuickAddGroup[];
  layout?: QuickAddLayout;
  onSelect: (id: QuickAddActionId) => void;
  /** Focus the search field on open (desktop only: on the phone it would raise the keyboard over the list). */
  autoFocusSearch?: boolean;
}

const ICON_TILE = "flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary";
const GROUP_TITLE = "px-3 pb-1 text-sm font-medium text-text-3";

function ListLayout({ groups, onSelect }: Pick<QuickAddChooserProps, "groups" | "onSelect">) {
  const { t: tr } = useLocalization();
  return (
      <div className="flex flex-col">
        {groups.map((group) => (
          <section key={group.section.id} aria-label={tr(group.section.title)} className="flex flex-col pt-3 first:pt-0">
            <h3 className={GROUP_TITLE}>
              {tr(group.section.title)}
              {group.current ? <span className="text-text-3/80"> · {tr("qui")}</span> : null}
            </h3>
            {group.actions.map((action) => {
              const Icon = QUICK_ADD_ICONS[action.id];
              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => onSelect(action.id)}
                  className="flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted"
                >
                  <span className={ICON_TILE}>
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold leading-tight">{tr(action.title)}</span>
                    <span className="block text-xs leading-snug text-text-2">{tr(action.description)}</span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>
  );
}

function TilesLayout({ groups, onSelect }: Pick<QuickAddChooserProps, "groups" | "onSelect">) {
  const { t: tr } = useLocalization();
  return (
    <ul className="grid grid-cols-3 gap-2" role="list">
      {groups.flatMap((group) =>
        group.actions.map((action) => {
          const Icon = QUICK_ADD_ICONS[action.id];
          return (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onSelect(action.id)}
                title={tr(action.description)}
                className={cn(
                  "flex h-full min-h-24 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl px-1.5 py-3 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  group.current ? "bg-sun/15 hover:bg-sun/25" : "bg-muted/70 hover:bg-muted"
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-background text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="text-[13px] font-semibold leading-tight text-balance">{tr(action.short)}</span>
              </button>
            </li>
          );
        })
      )}
    </ul>
  );
}

function SearchLayout({ groups, onSelect, autoFocusSearch }: Pick<QuickAddChooserProps, "groups" | "onSelect" | "autoFocusSearch">) {
  const { t: tr } = useLocalization();
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const needle = query.trim().toLocaleLowerCase();
  const rows = groups.flatMap((group) =>
    group.actions
      .map((action) => ({ action, group }))
      .filter(({ action }) => !needle || [action.title, action.short, action.description, group.section.title].some((text) => tr(text).toLocaleLowerCase().includes(needle)))
  );
  const activeIndex = Math.min(active, Math.max(rows.length - 1, 0));
  return (
    <div className="flex flex-col gap-2">
      <label className="flex h-11 items-center gap-2 rounded-full bg-muted px-4 text-text-2 focus-within:ring-2 focus-within:ring-ring">
        <SearchIcon className="size-4 shrink-0" aria-hidden="true" />
        <input
          type="search"
          value={query}
          autoFocus={autoFocusSearch}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => Math.min(i + 1, rows.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (event.key === "Enter" && rows[activeIndex]) {
              event.preventDefault();
              onSelect(rows[activeIndex].action.id);
            }
          }}
          placeholder={tr("Movimento, mutuo, obiettivo…")}
          aria-label={tr("Cerca cosa aggiungere")}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-text-3"
        />
      </label>
      <ul className="flex flex-col" role="list">
        {rows.map(({ action, group }, index) => {
          const Icon = QUICK_ADD_ICONS[action.id];
          return (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onSelect(action.id)}
                onPointerMove={() => setActive(index)}
                className={cn(
                  "flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                  index === activeIndex && "md:bg-muted"
                )}
              >
                <Icon className="size-[18px] shrink-0 text-primary" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{tr(action.title)}</span>
                <span className="shrink-0 text-xs text-text-3">{tr(group.section.title)}</span>
              </button>
            </li>
          );
        })}
        {rows.length === 0 ? <li className="px-3 py-4 text-sm text-text-2">{tr("Niente con questo nome.")}</li> : null}
      </ul>
    </div>
  );
}

/** The chooser in the chosen layout; it only reports the choice, the caller opens the form. */
export function QuickAddChooser({ groups, layout = "list", onSelect, autoFocusSearch = false }: QuickAddChooserProps) {
  if (layout === "tiles") return <TilesLayout groups={groups} onSelect={onSelect} />;
  if (layout === "search") return <SearchLayout groups={groups} onSelect={onSelect} autoFocusSearch={autoFocusSearch} />;
  return <ListLayout groups={groups} onSelect={onSelect} />;
}
