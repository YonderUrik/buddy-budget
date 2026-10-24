"use client";

/**
 * «Aggiungi» for the whole app: one chooser of what can be added in every section, opened from the bottom bar on the
 * phone and from the sidebar on desktop. A pick opens the section's own form over the current page, or goes to the page
 * that does the adding (file import, pension data, goals). Mounted once in the signed-in layout.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocalization } from "@/lib/localization/provider";
import { track } from "@/lib/analytics";
import {
  isQuickAddForm,
  quickAddArea,
  quickAddGroups,
  QUICK_ADD_PAGE_HREFS,
  QUICK_ADD_PARAM,
  type QuickAddActionId,
  type QuickAddFormId,
  type QuickAddSource,
} from "@/lib/quick-add/actions";
import { cn } from "@/lib/utils";
import { QuickAddChooser, type QuickAddLayout } from "./quick-add-chooser";

const QuickAddForms = dynamic(() => import("./quick-add-forms").then((m) => m.QuickAddForms), { ssr: false });

/** PROTOTYPE: the three options shown to Daniele, switched with localStorage `bb-quick-add-style`. */
export type QuickAddStyle = "a" | "b" | "c";
const STYLE_KEY = "bb-quick-add-style";

export interface QuickAddStyleConfig {
  /** Where the button sits on the phone: in the middle of the bottom bar, or a round button beside it. */
  placement: "center" | "beside";
  /** Desktop: a full-width pill at the top of the menu, or a round button next to the logo. */
  sidebar: "pill" | "round";
  layout: QuickAddLayout;
  /** Desktop panel: next to the button, or a window in the middle of the screen. */
  panel: "anchored" | "centered";
  /** Keyboard shortcut that opens it on desktop. */
  shortcut?: string;
}

export const QUICK_ADD_STYLES: Record<QuickAddStyle, QuickAddStyleConfig> = {
  a: { placement: "center", sidebar: "pill", layout: "list", panel: "anchored" },
  b: { placement: "beside", sidebar: "round", layout: "tiles", panel: "centered" },
  c: { placement: "center", sidebar: "pill", layout: "search", panel: "centered", shortcut: "N" },
};

function readStyle(): QuickAddStyle {
  try {
    const value = localStorage.getItem(STYLE_KEY);
    return value === "b" || value === "c" ? value : "a";
  } catch {
    return "a";
  }
}

export interface QuickAddApi {
  /** Opens the chooser; `anchor` is the button that opened it (the desktop panel sits next to it). */
  open: (source: QuickAddSource, anchor?: HTMLElement | null) => void;
  /** Opens one form directly, skipping the chooser. */
  start: (id: QuickAddActionId) => void;
  style: QuickAddStyleConfig;
}

const QuickAddContext = React.createContext<QuickAddApi | null>(null);

/** «Aggiungi» API; null outside the provider (the entry points then do not appear). */
export function useQuickAdd(): QuickAddApi | null {
  return React.useContext(QuickAddContext);
}

const subscribeNoop = () => () => {};

/** Opens «Aggiungi» from a link with `?aggiungi=`, then takes the parameter out of the address (a reload does not reopen it). */
function LinkOpener({ onLink }: { onLink: (target: string) => void }) {
  const target = useSearchParams().get(QUICK_ADD_PARAM);
  React.useEffect(() => {
    if (!target) return;
    const params = new URLSearchParams(window.location.search);
    params.delete(QUICK_ADD_PARAM);
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
    onLink(target);
  }, [target, onLink]);
  return null;
}

export function QuickAddProvider({ children }: { children: React.ReactNode }) {
  const { t: tr, productCountry } = useLocalization();
  const router = useRouter();
  const pathname = usePathname();
  const styleId = React.useSyncExternalStore(subscribeNoop, readStyle, () => "a" as const);
  const style = QUICK_ADD_STYLES[styleId];
  const [chooser, setChooser] = React.useState<{ open: boolean; anchor: DOMRect | null; source: QuickAddSource }>({ open: false, anchor: null, source: "barra" });
  const [form, setForm] = React.useState<QuickAddFormId | null>(null);
  // The forms' code loads at the first pick and then stays, so a closing form can animate out.
  const [formsLoaded, setFormsLoaded] = React.useState(false);
  const groups = React.useMemo(() => quickAddGroups(productCountry, pathname), [productCountry, pathname]);

  const start = React.useCallback(
    (id: QuickAddActionId) => {
      if (isQuickAddForm(id)) {
        setFormsLoaded(true);
        setForm(id);
      }
      else router.push(QUICK_ADD_PAGE_HREFS[id]);
    },
    [router]
  );
  const open = React.useCallback(
    (source: QuickAddSource, anchor?: HTMLElement | null) => {
      setChooser({ open: true, anchor: anchor?.getBoundingClientRect() ?? null, source });
      track("quick_add_opened", { source, area: quickAddArea(pathname) });
    },
    [pathname]
  );

  // Desktop shortcut (option C): the key alone, outside text fields.
  React.useEffect(() => {
    if (!style.shortcut) return;
    const key = style.shortcut.toLowerCase();
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      event.preventDefault();
      open("tastiera");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [style.shortcut, open]);

  const fromLink = React.useCallback(
    (target: string) => {
      if (!isQuickAddForm(target as QuickAddActionId)) {
        open("link");
        return;
      }
      const id = target as QuickAddFormId;
      track("quick_add_chosen", { action: id, source: "link", here: groups.some((g) => g.current && g.actions.some((a) => a.id === id)) });
      start(id);
    },
    [open, start, groups]
  );

  const api = React.useMemo(() => ({ open, start, style }), [open, start, style]);
  const anchored = style.panel === "anchored" && chooser.anchor !== null;

  return (
    <QuickAddContext.Provider value={api}>
      {children}
      {/* `useSearchParams` needs its own Suspense boundary in a layout. */}
      <React.Suspense fallback={null}>
        <LinkOpener onLink={fromLink} />
      </React.Suspense>
      <Dialog open={chooser.open} onOpenChange={(next) => !next && setChooser((s) => ({ ...s, open: false }))}>
        <DialogContent
          className={cn(
            "gap-3 sm:p-4",
            style.layout === "tiles" ? "sm:max-w-xl" : "sm:max-w-sm",
            style.panel === "centered" && style.layout === "search" && "sm:top-[18vh] sm:translate-y-0",
            anchored && "sm:top-(--qa-top) sm:left-(--qa-left) sm:translate-x-0 sm:translate-y-0"
          )}
          style={anchored && chooser.anchor ? ({ "--qa-left": `${chooser.anchor.right + 12}px`, "--qa-top": `${chooser.anchor.top}px` } as React.CSSProperties) : undefined}
          data-quick-add-anchored={anchored ? "" : undefined}
        >
          <DialogHeader className="px-1 sm:px-2">
            <DialogTitle className="font-display text-[1.75rem] font-light leading-none">{tr("Cosa vuoi aggiungere?")}</DialogTitle>
            <DialogDescription className="sr-only">{tr("Scegli cosa aggiungere: si apre il modulo giusto.")}</DialogDescription>
          </DialogHeader>
          <QuickAddChooser
            groups={groups}
            layout={style.layout}
            autoFocusSearch={style.layout === "search" && typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches}
            onSelect={(id) => {
              setChooser((s) => ({ ...s, open: false }));
              const here = groups.some((g) => g.current && g.actions.some((a) => a.id === id));
              track("quick_add_chosen", { action: id, source: chooser.source, here });
              start(id);
            }}
          />
        </DialogContent>
      </Dialog>
      {formsLoaded ? <QuickAddForms form={form} onClose={() => setForm(null)} onSwitch={setForm} /> : null}
    </QuickAddContext.Provider>
  );
}
