import { CreditCard, Landmark, type LucideIcon } from "lucide-react";

export interface DebtsTab {
  href: string;
  label: string;
  icon?: LucideIcon;
}

/** Schede di Debiti. Lombard e Simulatore arrivano con le loro fasi. */
export const DEBTS_TABS: readonly DebtsTab[] = [
  { href: "/debiti", label: "Panoramica", icon: CreditCard },
  { href: "/debiti/finanziamenti", label: "Finanziamenti", icon: Landmark },
];
