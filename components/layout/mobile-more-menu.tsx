"use client";

/**
 * MobileMoreMenu
 *
 * Menu «Altro» della barra in basso su mobile: una vista a tutto schermo (non il pannello laterale della sidebar)
 * pensata per il pollice. Dall'alto: l'account, le sezioni che non stanno nella barra con una riga di spiegazione, il
 * riepilogo finanziario (lo slot `extra` della sidebar), le preferenze veloci (tema, nascondi importi) e uscita.
 * Si chiude con il pulsante ×, con Esc o con il tasto indietro del telefono (la voce di cronologia aggiunta
 * all'apertura viene consumata, così «indietro» non esce dall'app).
 *
 * Riusabilità: voci, spiegazioni, badge, slot e destinazioni arrivano da fuori; `onAction` segnala cosa è stato toccato.
 */

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { useTheme } from "next-themes";
import { ChevronRight, EyeOff, LogOut, Monitor, Moon, Settings, Sun, X } from "lucide-react";

import { usePrivacy } from "@/components/privacy-provider";
import { AppVersionLabel } from "@/components/layout/app-version-label";
import { SidebarSlotProvider } from "@/components/layout/sidebar-slot";
import type { NavBadge, NavItem } from "@/components/layout/sidebar";
import { Switch } from "@/components/ui/switch";
import { authClient } from "@/lib/auth/client";
import { LEGAL_LINKS } from "@/lib/legal";
import { cn } from "@/lib/utils";

/** Cosa ha toccato l'utente nel menu (tipo chiuso, per le statistiche d'uso). */
export type MoreMenuAction = "sezione" | "impostazioni" | "tema" | "importi" | "esci" | "informativa" | "quadro";

/** Spiegazione di una riga per `href`, in italiano semplice: cosa si trova dentro la sezione. */
export const MORE_MENU_HINTS: Record<string, string> = {
  "/pensione": "Fondi, rendimento e a quanto arriverai",
  "/analitiche": "Quando arrivi al traguardo e cosa cambia con le tue ipotesi",
};

const THEME_OPTIONS = [
  { value: "light", label: "Chiaro", icon: Sun },
  { value: "dark", label: "Scuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export interface MobileMoreMenuProps {
  open: boolean;
  onClose: () => void;
  /** Le sezioni da elencare (quelle che non stanno nella barra in basso). */
  items: NavItem[];
  /** Spiegazione sotto il nome di ogni sezione, per `href`. */
  hints?: Record<string, string>;
  badges?: Record<string, NavBadge>;
  activeHref?: string;
  /** Riepilogo finanziario sotto le sezioni (lo stesso slot della sidebar). */
  extra?: React.ReactNode;
  settingsHref?: string;
  onAction?: (action: MoreMenuAction) => void;
}

const ROW_CLASS =
  "flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors active:bg-muted hover:bg-muted focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const SECTION_TITLE_CLASS = "px-3 pb-1 pt-5 text-xs font-semibold uppercase tracking-wider text-text-3";

/** Chiude il menu con il tasto indietro del telefono: all'apertura aggiunge una voce di cronologia e la consuma. */
function useBackToClose(open: boolean, onClose: () => void): () => void {
  const onCloseRef = React.useRef(onClose);
  // Chiusura dovuta a una navigazione: la voce aggiunta all'apertura è già stata sostituita dalla destinazione (`replace`).
  const navigatingRef = React.useRef(false);
  React.useEffect(() => {
    onCloseRef.current = onClose;
  });
  React.useEffect(() => {
    if (!open) return;
    window.history.pushState({ bbMoreMenu: true }, "");
    navigatingRef.current = false;
    let closedByBack = false;
    const onPop = () => {
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      // Chiuso con ×/Esc/link: la voce aggiunta va tolta, ma solo se è ancora in cima (con un link è già stata superata).
      if (!closedByBack && !navigatingRef.current && (window.history.state as { bbMoreMenu?: boolean } | null)?.bbMoreMenu) window.history.back();
    };
  }, [open]);
  return () => {
    navigatingRef.current = true;
  };
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const subscribeNoop = () => () => {};

export function MobileMoreMenu({
  open,
  onClose,
  items,
  hints = MORE_MENU_HINTS,
  badges,
  activeHref,
  extra,
  settingsHref = "/impostazioni",
  onAction,
}: MobileMoreMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { hidden, toggle } = usePrivacy();
  const { data: sessionData } = authClient.useSession();
  const mounted = React.useSyncExternalStore(subscribeNoop, () => true, () => false);
  const markNavigating = useBackToClose(open, onClose);

  const user = mounted ? sessionData?.user : undefined;
  const userName = user?.name ?? "Il tuo account";
  const sections = items.filter((i) => !i.comingSoon);

  async function signOut() {
    markNavigating();
    onAction?.("esci");
    onClose();
    await authClient.signOut();
    router.replace("/login");
  }

  /** Azione che porta altrove: la destinazione prende il posto della voce di cronologia del menu. */
  function go(action: MoreMenuAction) {
    markNavigating();
    onAction?.(action);
    onClose();
  }

  /** I link del riepilogo (slot) sono link normali: li facciamo sostituire la voce del menu invece di accodarsi. */
  function replaceInternalLink(event: React.MouseEvent) {
    const anchor = (event.target as HTMLElement).closest("a[href]");
    const href = anchor?.getAttribute("href");
    if (!href || !href.startsWith("/") || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    go("quadro");
    router.replace(href);
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup
          aria-label="Altro"
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground outline-none duration-200 md:hidden data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-6 data-closed:animate-out data-closed:fade-out-0 data-closed:slide-out-to-bottom-6"
        >
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 pt-[env(safe-area-inset-top)] box-content">
            <DialogPrimitive.Title className="font-heading text-lg font-semibold">Altro</DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Chiudi il menu"
              className="-mr-2 flex size-11 items-center justify-center rounded-full text-text-2 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <X className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </header>

          <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {/* Account */}
            <Link href={settingsHref} replace onClick={() => go("impostazioni")} className={cn(ROW_CLASS, "mt-3 min-h-16 bg-muted/60")}>
              {user?.image ? (
                <Image src={user.image} alt="" width={40} height={40} className="size-10 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                >
                  {initialsOf(userName)}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold leading-tight">{userName}</span>
                <span className="block truncate text-xs text-text-2">{user?.email ?? "Profilo e impostazioni"}</span>
              </span>
              <Settings className="size-5 shrink-0 text-text-3" aria-hidden="true" />
            </Link>

            {/* Sezioni */}
            {sections.length > 0 ? (
              <>
                <h2 className={SECTION_TITLE_CLASS}>Sezioni</h2>
                <ul className="flex flex-col">
                  {sections.map((item) => {
                    const Icon = item.icon;
                    const active = activeHref ? activeHref === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
                    const badge = badges?.[item.href];
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          replace
                          aria-current={active ? "page" : undefined}
                          onClick={() => go("sezione")}
                          className={ROW_CLASS}
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="size-5" aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold leading-tight">{item.label}</span>
                            {hints[item.href] ? <span className="block text-xs leading-snug text-text-2">{hints[item.href]}</span> : null}
                          </span>
                          {badge && badge.count > 0 ? (
                            <span
                              aria-label={badge.ariaLabel}
                              className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold tabular-nums text-primary-foreground"
                            >
                              {badge.countLabel ?? badge.count}
                            </span>
                          ) : null}
                          <ChevronRight className="size-4 shrink-0 text-text-3" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </>
            ) : null}

            {/* Riepilogo: i moduli della sidebar */}
            {extra ? (
              <>
                <h2 className={SECTION_TITLE_CLASS}>Il tuo quadro</h2>
                <div className="px-1 text-sidebar-foreground [&_button]:min-h-11 [&_button[aria-pressed]]:min-w-11" onClickCapture={replaceInternalLink}>
                  <SidebarSlotProvider value={{ collapsed: false }}>{extra}</SidebarSlotProvider>
                </div>
              </>
            ) : null}

            {/* Preferenze veloci */}
            <h2 className={SECTION_TITLE_CLASS}>Preferenze</h2>
            <div className="px-3 pb-2">
              <p id="more-menu-theme" className="mb-2 text-sm font-medium">
                Tema
              </p>
              <div role="radiogroup" aria-labelledby="more-menu-theme" className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
                  const selected = (theme ?? "system") === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setTheme(value);
                        onAction?.("tema");
                      }}
                      className={cn(
                        "flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        selected ? "bg-card text-foreground shadow-sm" : "text-text-2"
                      )}
                    >
                      <Icon className="size-4" aria-hidden="true" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className={cn(ROW_CLASS, "cursor-pointer")}>
              <EyeOff className="size-5 shrink-0 text-text-2" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium leading-tight">Nascondi gli importi</span>
                <span className="block text-xs text-text-2">Utile quando qualcuno guarda lo schermo</span>
              </span>
              <Switch
                checked={hidden}
                onCheckedChange={() => {
                  toggle();
                  onAction?.("importi");
                }}
                aria-label="Nascondi gli importi"
              />
            </label>

            {/* Esci e note */}
            <div className="mt-4 border-t border-border pt-3">
              <button type="button" onClick={signOut} className={cn(ROW_CLASS, "text-neg")}>
                <LogOut className="size-5 shrink-0" aria-hidden="true" />
                <span className="text-[15px] font-medium">Esci</span>
              </button>
              <nav aria-label="Informazioni legali" className="mt-2 flex flex-wrap items-center gap-x-1 px-3">
                {LEGAL_LINKS.map((l) => (
                  <a
                    key={l.id}
                    href={l.href}
                    onClick={() => onAction?.("informativa")}
                    className="flex min-h-11 items-center px-2 text-xs text-text-2 underline-offset-4 hover:underline"
                  >
                    {l.label}
                  </a>
                ))}
                <AppVersionLabel className="ml-auto text-text-3" />
              </nav>
            </div>
          </div>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
