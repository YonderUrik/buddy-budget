"use client";

/**
 * App-wide search («Cerca»), mounted once in the signed-in layout: opened from the sidebar, the magnifier in the phone
 * top bar, ⌘K / Ctrl+K or «/» anywhere, or a `?cerca=` link. A pick goes to the thing's page or opens its «Aggiungi»
 * form. The last picks are remembered on this device (never amounts) and shown before typing.
 */

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useQuickAdd } from "@/components/domain/quick-add";
import { track } from "@/lib/analytics";
import { useLocalization } from "@/lib/localization/provider";
import { STATIC_ENTRIES } from "@/lib/search/static-index";
import type { QuickAddActionId } from "@/lib/quick-add/actions";
import type { SearchHit } from "@/lib/search/types";
import { SearchPalette } from "./search-palette";

type SearchSource = "sidebar" | "barra" | "tastiera";

export interface SearchApi {
  open: (source: SearchSource) => void;
}

const SearchContext = React.createContext<SearchApi | null>(null);

/** Search API; null outside the provider (the entry points then do not appear). */
export function useAppSearch(): SearchApi | null {
  return React.useContext(SearchContext);
}

const RECENT_KEY = "bb.search.recent";
const RECENT_LIMIT = 5;
/** Shortcuts before typing: what people look for most, in plain words. */
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
    const kept = { ...hit, amount: undefined };
    const list = [kept, ...readRecent().filter((h) => h.key !== hit.key)].slice(0, RECENT_LIMIT);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // Private window or blocked storage: search works, it just does not remember.
  }
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

  const open = React.useCallback((source: SearchSource, initial = "") => {
    setState({ open: true, initial, recent: readRecent() });
    track("search_opened", { source });
  }, []);

  React.useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open("tastiera");
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        open("tastiera");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // A new page closes the panel (a pick navigates).
  React.useEffect(() => setState((s) => (s.open ? { ...s, open: false } : s)), [pathname]);

  const idle = React.useMemo(() => {
    const shortcuts = SHORTCUT_IDS.map((id) => STATIC_ENTRIES.find((e) => e.id === id)).filter((e) => e !== undefined).map<SearchHit>((e) => ({
      key: `${e.group}:${e.id}`, group: e.group, icon: e.icon, title: tr(e.title), subtitle: tr(e.subtitle), href: e.quickAdd ? undefined : e.href, quickAdd: e.quickAdd, score: 0,
    }));
    return [
      { title: "Cercati di recente", hits: state.recent },
      { title: "Scorciatoie", hits: shortcuts },
    ];
  }, [state.recent, tr]);

  const pick = React.useCallback(
    (hit: SearchHit, position: number, text: string) => {
      track("search_result_opened", { group: hit.group, position, length: text.trim().length });
      remember(hit);
      setState((s) => ({ ...s, open: false }));
      if (hit.quickAdd && quickAdd) quickAdd.start(hit.quickAdd as QuickAddActionId);
      else if (hit.href) router.push(hit.href);
    },
    [quickAdd, router]
  );

  const api = React.useMemo(() => ({ open: (source: SearchSource) => open(source) }), [open]);
  const fromLink = React.useCallback((text: string) => open("tastiera", text), [open]);

  return (
    <SearchContext.Provider value={api}>
      {children}
      <React.Suspense fallback={null}>
        <LinkOpener onLink={fromLink} />
      </React.Suspense>
      <Dialog open={state.open} onOpenChange={(next) => !next && setState((s) => ({ ...s, open: false }))}>
        <DialogContent
          mobileLayout="fullscreen"
          data-origin-animation="none"
          className="flex flex-col gap-0 overflow-hidden p-0 pt-[env(safe-area-inset-top)] sm:top-[12vh] sm:max-w-2xl sm:translate-y-0 sm:rounded-3xl sm:pt-0"
        >
          <DialogTitle className="sr-only">{tr("Cerca in BuddyBudget")}</DialogTitle>
          <DialogDescription className="sr-only">{tr("Movimenti, titoli, conti, categorie, pagine e impostazioni.")}</DialogDescription>
          {state.open ? <SearchPalette idle={idle} initialQuery={state.initial} onPick={pick} onCancel={() => setState((s) => ({ ...s, open: false }))} /> : null}
        </DialogContent>
      </Dialog>
    </SearchContext.Provider>
  );
}
