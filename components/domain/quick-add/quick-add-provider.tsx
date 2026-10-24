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
  isQuickAddHere,
  quickAddArea,
  quickAddMenu,
  QUICK_ADD_PAGE_HREFS,
  QUICK_ADD_PARAM,
  type QuickAddActionId,
  type QuickAddFormId,
  type QuickAddSource,
} from "@/lib/quick-add/actions";
import { cn } from "@/lib/utils";
import { QuickAddChooser } from "./quick-add-chooser";
import type { QuickAddPrefill } from "./prefill";

const QuickAddForms = dynamic(() => import("./quick-add-forms").then((m) => m.QuickAddForms), { ssr: false });

export interface QuickAddApi {
  /** Opens the chooser; from the sidebar `anchor` is its button, and on a tablet or computer the panel opens next to it. */
  open: (source: QuickAddSource, anchor?: HTMLElement | null) => void;
  /** Opens one form directly, skipping the chooser; `prefill` gives it starting values. */
  start: (id: QuickAddActionId, prefill?: QuickAddPrefill) => void;
}

const QuickAddContext = React.createContext<QuickAddApi | null>(null);

/** «Aggiungi» API; null outside the provider (the entry points then do not appear). */
export function useQuickAdd(): QuickAddApi | null {
  return React.useContext(QuickAddContext);
}

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
  const [chooser, setChooser] = React.useState<{ open: boolean; anchor: DOMRect | null; source: QuickAddSource }>({ open: false, anchor: null, source: "barra" });
  const [form, setForm] = React.useState<QuickAddFormId | null>(null);
  const [prefill, setPrefill] = React.useState<QuickAddPrefill | null>(null);
  // The forms' code loads at the first pick and then stays, so a closing form can animate out.
  const [formsLoaded, setFormsLoaded] = React.useState(false);
  const menu = React.useMemo(() => quickAddMenu(productCountry), [productCountry]);

  const start = React.useCallback(
    (id: QuickAddActionId, values?: QuickAddPrefill) => {
      if (isQuickAddForm(id)) {
        setFormsLoaded(true);
        setPrefill(values ?? null);
        setForm(id);
      }
      else router.push(QUICK_ADD_PAGE_HREFS[id]);
    },
    [router]
  );
  const open = React.useCallback(
    (source: QuickAddSource, anchor?: HTMLElement | null) => {
      setChooser({ open: true, anchor: source === "sidebar" ? (anchor?.getBoundingClientRect() ?? null) : null, source });
      track("quick_add_opened", { source, area: quickAddArea(pathname) });
    },
    [pathname]
  );

  const fromLink = React.useCallback(
    (target: string) => {
      if (!isQuickAddForm(target as QuickAddActionId)) {
        open("link");
        return;
      }
      const id = target as QuickAddFormId;
      track("quick_add_chosen", { action: id, source: "link", here: isQuickAddHere(id, pathname) });
      start(id);
    },
    [open, start, pathname]
  );

  const api = React.useMemo(() => ({ open, start }), [open, start]);
  // Opened from the sidebar: the panel sits next to the button and the page stays visible (centred otherwise).
  const anchored = chooser.anchor !== null;

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
            // Tiles up to the tablet, then a list (see the chooser); always within the screen height.
            "gap-4 sm:max-h-[calc(100dvh-2rem)] sm:max-w-md sm:overflow-y-auto sm:p-5 md:max-w-sm md:gap-3 md:p-4",
            anchored && "md:top-(--qa-top) md:left-(--qa-left) md:max-h-[calc(100dvh-var(--qa-top)-1rem)] md:translate-x-0 md:translate-y-0"
          )}
          style={anchored && chooser.anchor ? ({ "--qa-left": `${chooser.anchor.right + 12}px`, "--qa-top": `${chooser.anchor.top}px` } as React.CSSProperties) : undefined}
          data-quick-add-anchored={anchored ? "" : undefined}
        >
          <DialogHeader className="px-1 sm:px-2">
            <DialogTitle className="font-display text-[1.75rem] font-light leading-none">{tr("Cosa vuoi aggiungere?")}</DialogTitle>
            <DialogDescription className="sr-only">{tr("Scegli cosa aggiungere: si apre il modulo giusto.")}</DialogDescription>
          </DialogHeader>
          <QuickAddChooser
            menu={menu}
            onSelect={(id) => {
              setChooser((s) => ({ ...s, open: false }));
              track("quick_add_chosen", { action: id, source: chooser.source, here: isQuickAddHere(id, pathname) });
              start(id);
            }}
          />
        </DialogContent>
      </Dialog>
      {formsLoaded ? <QuickAddForms form={form} prefill={prefill} onClose={() => setForm(null)} onSwitch={setForm} /> : null}
    </QuickAddContext.Provider>
  );
}
