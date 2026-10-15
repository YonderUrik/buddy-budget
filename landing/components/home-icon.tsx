import {
  Backpack, Ban, BarChart3, Bitcoin, Calculator, Car, ChartCandlestick, Code, CreditCard, Database, Download, Eye, FileSpreadsheet, FileText, Gift, House, KeyRound, Landmark, Layers,
  LayoutDashboard, Link2, PenLine, PieChart, Scale, Server, ShieldCheck, SlidersHorizontal, Stamp, TrendingUp, Umbrella, University, UserRound, Wallet,
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
  key: KeyRound,
  eye: Eye,
  ban: Ban,
  sliders: SlidersHorizontal,
  "file-text": FileText,
  database: Database,
  pencil: PenLine,
  chart: BarChart3,
  candles: ChartCandlestick,
  layers: Layers,
  bitcoin: Bitcoin,
  car: Car,
  spreadsheet: FileSpreadsheet,
};

/** Icona decorativa delle sezioni della home, con la misura e lo spessore del tratto usati nell'app. */
export function HomeIcon({ name, size = 18, className }: { name: HomeIconName; size?: number; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden="true" focusable="false" size={size} strokeWidth={1.75} className={className} />;
}
