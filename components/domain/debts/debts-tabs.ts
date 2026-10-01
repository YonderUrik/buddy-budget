import { CreditCard, FlaskConical, Gauge, Landmark, type LucideIcon } from "lucide-react";

export interface DebtsTab {
  href: string;
  label: string;
  icon?: LucideIcon;
}

/** Schede di Debiti. */
export const DEBTS_TABS: readonly DebtsTab[] = [
  { href: "/debiti", label: "Panoramica", icon: CreditCard },
  { href: "/debiti/finanziamenti", label: "Finanziamenti", icon: Landmark },
  { href: "/debiti/lombard", label: "Lombard", icon: Gauge },
  { href: "/debiti/simulatore", label: "Simulatore", icon: FlaskConical },
];
