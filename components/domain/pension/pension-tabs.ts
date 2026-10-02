import { BarChart3, Database, Hourglass, LayoutDashboard, Scale, type LucideIcon } from "lucide-react";

export interface PensionTab {
  href: string;
  label: string;
  icon?: LucideIcon;
}

/** Schede di Pensione. */
export const PENSION_TABS: readonly PensionTab[] = [
  { href: "/pensione", label: "Panoramica", icon: LayoutDashboard },
  { href: "/pensione/andamento", label: "Andamento", icon: BarChart3 },
  { href: "/pensione/scenari", label: "Scenari", icon: Scale },
  { href: "/pensione/proiezione", label: "Proiezione", icon: Hourglass },
  { href: "/pensione/dati", label: "I tuoi dati", icon: Database },
];
