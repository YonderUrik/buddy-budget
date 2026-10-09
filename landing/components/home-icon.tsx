import {
  Backpack, Calculator, Code, CreditCard, Download, Gift, House, Landmark, LayoutDashboard, Link2, PieChart, Scale, Server, ShieldCheck, Stamp,
  TrendingUp, Umbrella, University, UserRound, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { HomeIcon as HomeIconName } from "@/content/home";

/** Nome → icona lucide (la stessa libreria della sidebar dell'app: Panoramica = LayoutDashboard, Pensione = Umbrella). */
const ICONS: Record<HomeIconName, LucideIcon> = {
  gift: Gift,
  server: Server,
  landmark: Landmark,
  download: Download,
  code: Code,
  link: Link2,
  dashboard: LayoutDashboard,
  calculator: Calculator,
  backpack: Backpack,
  scale: Scale,
  stamp: Stamp,
  "landmark-gov": University,
  umbrella: Umbrella,
  house: House,
  wallet: Wallet,
  trending: TrendingUp,
  card: CreditCard,
  user: UserRound,
  shield: ShieldCheck,
  pie: PieChart,
};

/** Icona decorativa delle sezioni della home, con la misura e lo spessore del tratto usati nell'app. */
export function HomeIcon({ name, size = 18, className }: { name: HomeIconName; size?: number; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" focusable="false" size={size} strokeWidth={1.75} className={className} />;
}
