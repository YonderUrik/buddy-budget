import { BarChart3, Dices, Flame, Layers, ShieldAlert, Wallet, type LucideIcon } from "lucide-react";

export interface AnalyticsTab {
  href: string;
  label: string;
  icon?: LucideIcon;
}

/** Schede di Analitiche. */
export const ANALYTICS_TABS: readonly AnalyticsTab[] = [
  { href: "/analitiche", label: "Obiettivo FIRE", icon: Flame },
  { href: "/analitiche/simulazione", label: "Simulazione", icon: Dices },
  { href: "/analitiche/prelievi", label: "Prelievi", icon: Wallet },
  { href: "/analitiche/crescita", label: "Crescita", icon: BarChart3 },
  { href: "/analitiche/rischio", label: "Rischio", icon: ShieldAlert },
  { href: "/analitiche/costi", label: "Costi e tasse", icon: Layers },
];
