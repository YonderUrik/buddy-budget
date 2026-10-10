"use client";

/**
 * MobileTopbar
 *
 * Barra superiore visibile esclusivamente su mobile (< 768px, `md:hidden`).
 * Fornisce accesso alla navigazione tramite un hamburger button che apre
 * il drawer della sidebar.
 *
 * Contiene:
 * - Brand/logo testuale
 * - Hamburger button (apre il drawer via SidebarContext)
 * Tema e «Nascondi importi» stanno nel menu utente del drawer o in «Altro».
 *
 * Riusabilità: accetta `brandName` e `brandHref` come prop per essere
 * adattata ad altre app senza modifiche al componente.
 */

import Image from "next/image";
import { Menu } from "lucide-react";
import { useSidebar } from "@/components/layout/sidebar-context";

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

interface MobileTopbarProps {
  /** Nome del brand mostrato nella topbar. Default: "BuddyBudget". */
  brandName?: string;
  /** Mostra l'hamburger che apre il menu; da spegnere quando la navigazione sta nella barra in basso. Default: true. */
  showMenuButton?: boolean;
}

export function MobileTopbar({ brandName = "BuddyBudget", showMenuButton = true }: MobileTopbarProps) {
  const { openMobile } = useSidebar();

  return (
    <header
      className={[
        "md:hidden",
        "flex h-14 items-center justify-between",
        "bg-sidebar border-b border-sidebar-border",
        "px-4 shrink-0",
      ].join(" ")}
      aria-label="Barra di navigazione"
    >
      {/* Hamburger (senza, un riquadro vuoto mantiene il brand al centro) */}
      {showMenuButton ? (
      <button
        onClick={openMobile}
        className={[
          "flex size-9 items-center justify-center rounded-lg",
          "text-sidebar-foreground/70 hover:bg-sidebar-accent",
          "hover:text-sidebar-accent-foreground transition-colors duration-150",
        ].join(" ")}
        aria-label="Apri menu di navigazione"
        aria-haspopup="dialog"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>
      ) : (
        <span className="size-9" aria-hidden="true" />
      )}

      {/* Brand */}
      <span className="flex items-center gap-2 font-heading text-base font-bold text-sidebar-foreground">
        <Image
          src="/brand/logo-mark.svg"
          alt=""
          width={22}
          height={27}
          className="h-6 w-auto"
          aria-hidden="true"
        />
        {brandName}
      </span>

      {/* Riquadro vuoto: tiene il brand al centro */}
      <span className="size-9" aria-hidden="true" />
    </header>
  );
}
