import { BarChart3, Database, Hourglass, LayoutDashboard, Scale, type LucideIcon } from "lucide-react";

export interface PensionTab {
  href: string;
  label: string;
  icon?: LucideIcon;
  /** Riga di spiegazione nel menu su mobile (facoltativa). */
  description?: string;
}

/** Schede di Pensione. */
export const PENSION_TABS: readonly PensionTab[] = [
  { href: "/pensione", label: "Panoramica", icon: LayoutDashboard, description: "Il fondo in sintesi" },
  { href: "/pensione/andamento", label: "Andamento", icon: BarChart3, description: "Contributi e valore nel tempo" },
  { href: "/pensione/scenari", label: "Scenari", icon: Scale, description: "Cosa cambia con ipotesi diverse" },
  { href: "/pensione/proiezione", label: "Proiezione", icon: Hourglass, description: "Quanto potresti avere alla pensione" },
  { href: "/pensione/dati", label: "I tuoi dati", icon: Database, description: "Fondo, fotografie e importazioni" },
];
