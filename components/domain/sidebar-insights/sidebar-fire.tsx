"use client";

/**
 * Obiettivo FIRE nella sidebar: barra di avanzamento verso il numero FIRE, quanto manca e gli anni stimati, con gli
 * stessi numeri di Analitiche. Senza una spesa annua da cui stimarlo invita a completare le ipotesi.
 */

import Link from "next/link";
import { CollapsibleSection } from "@/components/domain/shared";
import type { SidebarFire } from "@/lib/sidebar/types";
import {
  fireBarWidth,
  formatFireProgress,
  formatSidebarAmount,
  formatYearsToFire,
} from "./sidebar-insights.utils";

export interface SidebarFireModuleProps {
  data: SidebarFire | undefined;
  loading: boolean;
  hidden: boolean;
  collapsed: boolean;
  /** Pagina con le ipotesi e i dettagli del calcolo. */
  analyticsHref?: string;
  onNavigate?: () => void;
  /** Chiamata al clic sul modulo (per le statistiche d'uso). */
  onItemClick?: () => void;
}

export function SidebarFireModule({
  data,
  loading,
  hidden,
  collapsed,
  analyticsHref = "/analitiche",
  onNavigate,
  onItemClick,
}: SidebarFireModuleProps) {
  if (collapsed) return null;
  if (loading) {
    return <div className="mt-1 h-16 animate-pulse rounded-lg bg-sidebar-accent" aria-busy="true" />;
  }
  if (!data) return null;
  const { progress, target, wealth, yearsToFire, currency } = data;
  const hasProgress = target !== null && progress !== null;
  const years = formatYearsToFire(yearsToFire);
  const handleClick = () => {
    onItemClick?.();
    onNavigate?.();
  };

  return (
    <CollapsibleSection
      id="fire"
      title="Obiettivo FIRE"
      summary={hasProgress ? formatFireProgress(progress) : undefined}
    >
      <Link
        href={analyticsHref}
        onClick={handleClick}
        className="block rounded-lg px-1.5 py-1 transition-colors hover:bg-sidebar-accent focus-visible:bg-sidebar-accent focus-visible:outline-none"
      >
        {hasProgress ? (
          <>
            <div
              role="progressbar"
              aria-label="Avanzamento verso il numero FIRE"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(fireBarWidth(progress))}
              className="h-1.5 overflow-hidden rounded-full bg-sidebar-accent"
            >
              <div className="h-full rounded-full bg-sidebar-primary" style={{ width: `${fireBarWidth(progress)}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-sidebar-foreground">
              <span className="font-heading text-sm font-semibold tabular-nums">{formatFireProgress(progress)}</span>{" "}
              <span className="text-sidebar-foreground/60">del numero FIRE</span>
            </p>
            <p className="text-[11px] text-sidebar-foreground/60">
              {progress >= 1
                ? "Obiettivo raggiunto"
                : `Mancano ${formatSidebarAmount(Math.max(target - wealth, 0), currency, hidden)}${years ? ` · ${years}` : ""}`}
            </p>
          </>
        ) : (
          <p className="text-[11px] leading-snug text-sidebar-foreground/60">
            Indica la spesa annua in pensione in Analitiche per stimare il tuo numero FIRE.
          </p>
        )}
      </Link>
    </CollapsibleSection>
  );
}
