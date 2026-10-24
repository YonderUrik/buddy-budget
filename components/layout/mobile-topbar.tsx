"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * MobileTopbar
 *
 * Barra superiore visibile esclusivamente su mobile (< 768px, `md:hidden`).
 * Fornisce accesso alla navigazione tramite un hamburger button che apre
 * il drawer della sidebar.
 *
 * Contiene:
 * - Brand/logo testuale, che è un link alla pagina iniziale dell'app (`/`)
 * - Hamburger button (apre il drawer via SidebarContext)
 * Tema e «Nascondi importi» stanno nel menu utente del drawer o in «Altro».
 *
 * Riusabilità: accetta `brandName` come prop per essere
 * adattata ad altre app senza modifiche al componente.
 */

import type * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, MessageCircleQuestion } from "lucide-react";
import { useSidebar } from "@/components/layout/sidebar-context";

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface MobileTopbarProps {
  /** Nome del brand mostrato nella topbar. Default: "BuddyBudget". */
  brandName?: string;
  /** Mostra l'hamburger che apre il menu; da spegnere quando la navigazione sta nella barra in basso. Default: true. */
  showMenuButton?: boolean;
  /** Apre il foglio «Scrivici»; senza, a destra resta uno spazio vuoto. */
  onOpenSupport?: () => void;
  /**
   * Replaces the left slot (e.g. with a back button); receives the default left content to show when it has nothing
   * to render. An element marked `data-topbar-back` takes the brand's place too, so a long label has room.
   */
  leading?: (fallback: React.ReactNode) => React.ReactNode;
}

export function MobileTopbar({ brandName = "BuddyBudget", showMenuButton = true, onOpenSupport, leading }: MobileTopbarProps) {
  const { t: tr } = useLocalization();
  const { openMobile } = useSidebar();

  // Hamburger (without it, an empty square keeps the brand centred).
  const menuSlot = showMenuButton ? (
      <button
        onClick={openMobile}
        className={[
          "flex size-9 items-center justify-center rounded-lg",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent",
          "hover:text-sidebar-accent-foreground transition-colors duration-150",
        ].join(" ")}
        aria-label={tr("Apri menu di navigazione")}
        aria-haspopup="dialog"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      ) : (
        <span className="size-9" aria-hidden="true" />
      );

  return (
    <header
      className={[
        "group md:hidden",
        // Below the notch/camera cutout when the page is drawn under the status bar (0 in a normal browser tab).
        "grid box-content h-14 grid-cols-[1fr_auto_1fr] items-center gap-2 pt-[env(safe-area-inset-top)]",
        "bg-sidebar border-b border-sidebar-border",
        "px-4 shrink-0",
      ].join(" ")}
      aria-label={tr("Barra di navigazione")}
    >
      <div className="col-start-1 row-start-1 flex min-w-0 items-center justify-self-start group-has-[[data-topbar-back]]:col-span-2">
        {leading ? leading(menuSlot) : menuSlot}
      </div>

      {/* Brand — torna alla pagina iniziale */}
      <Link
        href="/"
        aria-label={tr("{0}: torna alla pagina iniziale", {0: brandName})}
        className="col-start-2 row-start-1 flex items-center gap-2 rounded-lg font-heading text-base font-bold text-sidebar-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring group-has-[[data-topbar-back]]:hidden"
      >
        <Image
          src="/brand/logo-mark.svg"
          alt={""}
          width={22}
          height={27}
          className="h-6 w-auto"
          aria-hidden="true"
        />
        {brandName}
      </Link>

      {onOpenSupport ? (
        <button
          type="button"
          onClick={onOpenSupport}
          className="col-start-3 row-start-1 flex size-9 items-center justify-center justify-self-end rounded-lg text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          aria-label={tr("Scrivici: segnala un problema, una domanda o un'idea")}
        >
          <MessageCircleQuestion className="size-5" aria-hidden="true" />
        </button>
      ) : (
        <span className="col-start-3 row-start-1 size-9 justify-self-end" aria-hidden="true" />
      )}
    </header>
  );
}
