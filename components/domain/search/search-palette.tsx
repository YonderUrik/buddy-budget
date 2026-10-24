"use client";

/**
 * The app-wide search panel: one field, results grouped by kind as the user types. Pages, settings and «Aggiungi»
 * actions answer from a list in the browser at every keystroke; the user's data (movements, accounts, securities…)
 * comes from `GET /api/search` after a short pause in typing, and the previous answer stays on screen until the new one
 * arrives, so the list never empties and refills. Arrow keys move, Enter opens, Esc closes.
 */

import * as React from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LoaderCircleIcon, SearchIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { authClient } from "@/lib/auth/client";
import { foldText } from "@/lib/search/normalize";
import { searchStatic } from "@/lib/search/static-index";
import { arrangeHits, SEARCH_GROUP_TITLES } from "@/lib/search/groups";
import type { SearchHit, SearchResponse } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { SearchRow } from "./search-row";

/** Pause in typing before asking the server (the static part does not wait). */
export const SEARCH_DEBOUNCE_MS = 180;
/** Characters before the server is asked. */
const SERVER_MIN_LENGTH = 2;

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

async function fetchSearch(query: string, signal: AbortSignal): Promise<SearchResponse> {
  const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal });
  if (!response.ok) throw new Error(`search ${response.status}`);
  return response.json();
}

export interface SearchPaletteProps {
  /** Hits shown before typing (recent picks and shortcuts). */
  idle: { title: string; hits: SearchHit[] }[];
  onPick: (hit: SearchHit, position: number, query: string) => void;
  onCancel: () => void;
  /** Text in the field when it opens (for the captures). */
  initialQuery?: string;
}

export function SearchPalette({ idle, onPick, onCancel, initialQuery = "" }: SearchPaletteProps) {
  const { t: tr, productCountry, locale } = useLocalization();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const [text, setText] = React.useState(initialQuery);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const query = foldText(text);
  const serverQuery = useDebounced(query, SEARCH_DEBOUNCE_MS);
  const asking = serverQuery.length >= SERVER_MIN_LENGTH;

  const server = useQuery({
    queryKey: ["search", serverQuery],
    queryFn: ({ signal }) => fetchSearch(serverQuery, signal),
    enabled: asking,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const blocks = React.useMemo(() => {
    if (query === "") return idle.filter((b) => b.hits.length > 0).map((b) => ({ id: b.title, title: b.title, hits: b.hits }));
    const local = searchStatic(query, productCountry, (key) => tr(key));
    const remote = asking && query.length >= SERVER_MIN_LENGTH ? (server.data?.hits ?? []).map((h) => ({ ...h, title: h.title, subtitle: h.subtitle ? tr(h.subtitle) : undefined })) : [];
    return arrangeHits([...remote, ...local]).map((b) => ({ id: b.id, title: b.id === "top" ? "Risultato migliore" : SEARCH_GROUP_TITLES[b.id], hits: b.hits }));
  }, [query, idle, productCountry, tr, asking, server.data]);

  const flat = blocks.flatMap((b) => b.hits);
  React.useEffect(() => setActive(0), [query]);
  const waiting = query.length >= SERVER_MIN_LENGTH && (query !== serverQuery || server.isFetching);
  const optionId = (index: number) => `${listId}-${index}`;

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(flat.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && flat[active]) {
      event.preventDefault();
      onPick(flat[active], active, text);
    }
  }

  React.useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  });

  let index = -1;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 sm:px-4 sm:pt-4">
        <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full bg-muted px-4 dark:bg-background/70 sm:h-13">
          <SearchIcon className="size-5 shrink-0 text-text-3" aria-hidden="true" />
          <input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={tr("Cerca movimenti, titoli, conti, impostazioni…")}
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={flat.length > 0 ? optionId(active) : undefined}
            aria-label={tr("Cerca in BuddyBudget")}
            enterKeyHint="search"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-text-3 sm:text-[17px]"
          />
          {waiting ? <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-text-3" aria-hidden="true" /> : null}
        </label>
        <button type="button" onClick={onCancel} className="h-11 shrink-0 cursor-pointer rounded-full px-2 text-[15px] font-medium text-primary sm:hidden">
          {tr("Annulla")}
        </button>
        <kbd className="hidden h-7 shrink-0 items-center rounded-md bg-muted px-2 font-sans text-xs text-text-3 sm:flex dark:bg-background/70">esc</kbd>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 sm:max-h-[min(60vh,560px)] sm:px-3">
        {blocks.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-text-2">
            {waiting ? tr("Sto cercando…") : tr("Niente con «{0}». Prova con una parola sola, un importo come 45,90 o un ISIN.", { 0: text.trim() })}
          </p>
        ) : (
          <ul id={listId} role="listbox" aria-label={tr("Risultati")} className="flex flex-col gap-3">
            {blocks.map((block) => (
              <li key={block.id} role="presentation">
                <h3 className="px-2.5 pb-1 text-sm font-medium text-text-3">{tr(block.title)}</h3>
                <ul role="presentation" className="flex flex-col">
                  {block.hits.map((hit) => {
                    index += 1;
                    const position = index;
                    return (
                      <SearchRow
                        key={`${block.id}:${hit.key}`}
                        id={optionId(position)}
                        hit={hit}
                        query={query}
                        active={position === active}
                        currency={currency}
                        locale={locale}
                        onHover={() => setActive(position)}
                        onPick={() => onPick(hit, position, text)}
                      />
                    );
                  })}
                </ul>
                {block.id === "movimenti" && (server.data?.moreMovements ?? 0) > 0 ? (
                  <p className="px-2.5 pt-1 text-xs text-text-3">{tr("E altri {0} in Movimenti", { 0: String(server.data?.moreMovements) })}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={cn("hidden items-center gap-4 border-t border-border px-5 py-2.5 text-xs text-text-3 sm:flex")}>
        <span>↑ ↓ {tr("per scegliere")}</span>
        <span>⏎ {tr("per aprire")}</span>
        <span className="ml-auto">⌘K {tr("da ogni pagina")}</span>
      </div>
    </div>
  );
}
