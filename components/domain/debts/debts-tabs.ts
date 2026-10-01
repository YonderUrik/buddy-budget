import { CreditCard, Gauge, Landmark, type LucideIcon } from "lucide-react";

export interface DebtsTab {
  href: string;
  label: string;
  icon?: LucideIcon;
}

/** Schede di Debiti. Il Simulatore arriva con la sua fase. */
export const DEBTS_TABS: readonly DebtsTab[] = [
  { href: "/debiti", label: "Panoramica", icon: CreditCard },
  { href: "/debiti/finanziamenti", label: "Finanziamenti", icon: Landmark },
  { href: "/debiti/lombard", label: "Lombard", icon: Gauge },
];
