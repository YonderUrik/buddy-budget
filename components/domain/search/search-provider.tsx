"use client";

/**
 * App-wide search («Cerca»), mounted once in the signed-in layout: opened from the field above the page on desktop,
 * by pulling the page down on the phone (or the field heading «Altro»), ⌘K / Ctrl+K or «/» anywhere, or a `?cerca=` link. A result goes to its page or opens its «Aggiungi» form;
 * a sentence like «comprato 3 Apple a 50 € oggi» opens the form already filled in, to check and save. The last picks
 * are remembered on this device (never amounts) and shown on the phone before typing.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuickAdd, type QuickAddPrefill } from "@/components/domain/quick-add";
import { track } from "@/lib/analytics";
import type { CommandDraft } from "@/lib/commands";
import type { Instrument } from "@/lib/db/schema/investments";
import { useLocalization } from "@/lib/localization/provider";
import { STATIC_ENTRIES } from "@/lib/search/static-index";
import type { QuickAddActionId } from "@/lib/quick-add/actions";
import type { SearchHit } from "@/lib/search/types";
import { Spotlight } from "./spotlight";
import type { SpotlightBlock } from "./use-spotlight";

type SearchSource = "campo" | "altro" | "tirando" | "tastiera";

export interface SearchApi {
  open: (source: SearchSource) => void;
  /** True while the panel is open (an entry point can step aside). */
  isOpen: boolean;
}

const SearchContext = React.createContext<SearchApi | null>(null);

/** Search API; null outside the provider (the entry points then do not appear). */
export function useAppSearch(): SearchApi | null {
  return React.useContext(SearchContext);
}

const RECENT_KEY = "bb.search.recent";
const RECENT_LIMIT = 5;
/** Shortcuts before typing (phone): what people look for most, in plain words. */
const SHORTCUT_IDS = ["aggiungi-movimento", "budget", "categorizza", "notifiche"];
export const SEARCH_PARAM = "cerca";

function readRecent(): SearchHit[] {
  try {
    return JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]") as SearchHit[];
  } catch {
    return [];
  }
}

function remember(hit: SearchHit) {
  try {
    const kept: SearchHit = { ...hit, amount: undefined, instrument: undefined };
    const list = [kept, ...readRecent().filter((h) => h.key !== hit.key)].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Private window or blocked storage: search works, it just does not remember.
  }
}

/** The «Aggiungi» form and its starting values for a sentence's draft. */
export function prefillFor(draft: CommandDraft, instrument: Instrument | null): { form: QuickAddActionId; prefill: QuickAddPrefill } {
  if (draft.kind === "spesa" || draft.kind === "entrata") {
    return { form: "movimento", prefill: { movimento: { direction: draft.kind, amount: draft.amount, description: draft.subject, date: draft.date } } };
  }
  const instrumentQuery = instrument ? undefined : draft.subject || undefined;
  if (draft.kind === "dividendo") {
    return { form: "operazione", prefill: { operazione: { instrument, type: "dividendo", grossAmount: draft.amount, date: draft.date, instrumentQuery } } };
  }
  // A price written in another currency than the security's is left to the form (it knows the exchange rate).
  const sameCurrency = !draft.currency || !instrument || draft.currency === instrument.currency;
  const written = draft.price ?? (draft.amount !== null && draft.quantity ? draft.amount / draft.quantity : null);
  const price = sameCurrency ? written : null;
  return {
    form: "operazione",
    prefill: { operazione: { instrument, type: draft.kind, quantity: draft.quantity, price, priceFromUser: price !== null, date: draft.date, instrumentQuery } },
  };
}

/** Opens the search from a `?cerca=` link, prefilled with its text, then takes the parameter out of the address. */
function LinkOpener({ onLink }: { onLink: (text: string) => void }) {
  const target = useSearchParams().get(SEARCH_PARAM);
  React.useEffect(() => {
    if (target === null) return;
    const params = new URLSearchParams(window.location.search);
    params.delete(SEARCH_PARAM);
    const rest = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}`);
    onLink(target);
  }, [target, onLink]);
  return null;
}

export function SearchProvider({ children }: { children: React.ReactNode }) {
  const { t: tr } = useLocalization();
  const router = useRouter();
  const pathname = usePathname();
  const quickAdd = useQuickAdd();
  const [state, setState] = React.useState<{ open: boolean; initial: string; recent: SearchHit[] }>({ open: false, initial: "", recent: [] });
  const returnFocus = React.useRef<HTMLElement | null>(null);

  const open = React.useCallback((source: SearchSource, initial = "") => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setState({ open: true, initial, recent: readRecent() });
    track("search_opened", { source });
  }, []);
  const close = React.useCallback(() => {
    setState((s) => ({ ...s, open: false }));
    returnFocus.current?.focus?.();
  }, []);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (state.open) close();
        else open("tastiera");
      } else if (event.key === "/" && !typing && !state.open) {
        event.preventDefault();
        open("tastiera");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, state.open]);

  // A new page closes the panel (a pick navigates).
  const [lastPath, setLastPath] = React.useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    if (state.open) setState((s) => ({ ...s, open: false }));
  }

  const idle = React.useMemo<SpotlightBlock[]>(() => {
    const shortcuts = SHORTCUT_IDS.map((id) => STATIC_ENTRIES.find((e) => e.id === id))
      .filter((e) => e !== undefined)
      .map<SearchHit>((e) => ({ key: `${e.group}:${e.id}`, group: e.group, icon: e.icon, title: tr(e.title), subtitle: tr(e.subtitle), href: e.quickAdd ? undefined : e.href, quickAdd: e.quickAdd, score: 0 }));
    const asBlock = (id: string, title: string, hits: SearchHit[]): SpotlightBlock => ({ id, title, items: hits.map((hit) => ({ type: "hit", key: hit.key, hit })) });
    return [asBlock("recenti", "Cercati di recente", state.recent), asBlock("scorciatoie", "Scorciatoie", shortcuts)];
  }, [state.recent, tr]);

  const pickHit = React.useCallback(
    (hit: SearchHit, position: number, text: string) => {
      track("search_result_opened", { group: hit.group, position, length: text.trim().length });
      remember(hit);
      setState((s) => ({ ...s, open: false }));
      if (hit.quickAdd && quickAdd) quickAdd.start(hit.quickAdd as QuickAddActionId);
      else if (hit.href) router.push(hit.href);
    },
    [quickAdd, router]
  );

  const runCommand = React.useCallback(
    (draft: CommandDraft, instrument: Instrument | null) => {
      track("search_command_opened", { kind: draft.kind, source: draft.source, complete: draft.subject !== "" && (draft.amount !== null || draft.quantity !== null) });
      setState((s) => ({ ...s, open: false }));
      const { form, prefill } = prefillFor(draft, instrument);
      quickAdd?.start(form, prefill);
    },
    [quickAdd]
  );

  const api = React.useMemo<SearchApi>(() => ({ open, isOpen: state.open }), [open, state.open]);
  const fromLink = React.useCallback((text: string) => open("tastiera", text), [open]);
  const mounted = React.useSyncExternalStore(() => () => {}, () => true, () => false);

  return (
    <SearchContext.Provider value={api}>
      {children}
      <React.Suspense fallback={null}>
        <LinkOpener onLink={fromLink} />
      </React.Suspense>
      {mounted
        ? createPortal(
            <AnimatePresence>
              {state.open ? <Spotlight key="spotlight" initialText={state.initial} idle={idle} onClose={close} onPickHit={pickHit} onCommand={runCommand} /> : null}
            </AnimatePresence>,
            document.body
          )
        : null}
    </SearchContext.Provider>
  );
}
