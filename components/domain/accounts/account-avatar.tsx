/** Avatar conto: icona Lucide su cerchio colorato. */

import * as React from "react";
import {
  Wallet,
  CreditCard,
  Banknote,
  Building2,
  PiggyBank,
  TrendingUp,
  Home,
  Car,
  Plane,
  ShoppingCart,
  Briefcase,
  DollarSign,
  Bitcoin,
  Landmark,
  Coins,
  Receipt,
  Package,
  Gift,
  Heart,
  Star,
  Zap,
  Coffee,
  ShoppingBag,
  User,
  Globe,
  Smartphone,
  Watch,
  GraduationCap,
  Flame,
  Music,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountColor, AccountIcon } from "@/lib/validation/accounts";

export const ICON_MAP: Record<AccountIcon, LucideIcon> = {
  wallet: Wallet,
  "credit-card": CreditCard,
  banknote: Banknote,
  "building-2": Building2,
  "piggy-bank": PiggyBank,
  "trending-up": TrendingUp,
  home: Home,
  car: Car,
  plane: Plane,
  "shopping-cart": ShoppingCart,
  briefcase: Briefcase,
  "dollar-sign": DollarSign,
  bitcoin: Bitcoin,
  landmark: Landmark,
  coins: Coins,
  receipt: Receipt,
  package: Package,
  gift: Gift,
  heart: Heart,
  star: Star,
  zap: Zap,
  coffee: Coffee,
  "shopping-bag": ShoppingBag,
  user: User,
  globe: Globe,
  smartphone: Smartphone,
  watch: Watch,
  "graduation-cap": GraduationCap,
  flame: Flame,
  music: Music,
};

const COLOR_MAP: Record<AccountColor, { bg: string; fg: string }> = {
  slate: {
    bg: "bg-slate-100 dark:bg-slate-800",
    fg: "text-slate-500 dark:text-slate-400",
  },
  blue: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    fg: "text-blue-600 dark:text-blue-400",
  },
  green: {
    bg: "bg-green-100 dark:bg-green-900/40",
    fg: "text-green-600 dark:text-green-400",
  },
  yellow: {
    bg: "bg-yellow-100 dark:bg-yellow-900/40",
    fg: "text-yellow-600 dark:text-yellow-400",
  },
  purple: {
    bg: "bg-purple-100 dark:bg-purple-900/40",
    fg: "text-purple-600 dark:text-purple-400",
  },
  orange: {
    bg: "bg-orange-100 dark:bg-orange-900/40",
    fg: "text-orange-600 dark:text-orange-400",
  },
  red: {
    bg: "bg-red-100 dark:bg-red-900/40",
    fg: "text-red-600 dark:text-red-400",
  },
  teal: {
    bg: "bg-teal-100 dark:bg-teal-900/40",
    fg: "text-teal-600 dark:text-teal-400",
  },
};

export interface AccountAvatarProps {
  color: AccountColor;
  icon: AccountIcon;
  size?: number;
  className?: string;
}

export function AccountAvatar({
  color,
  icon,
  size = 16,
  className,
}: AccountAvatarProps) {
  const Icon = ICON_MAP[icon] ?? Wallet;
  const { bg, fg } = COLOR_MAP[color] ?? COLOR_MAP.slate;

  return (
    <div
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-full",
        bg,
        className
      )}
      aria-hidden="true"
    >
      <Icon size={size} className={fg} />
    </div>
  );
}
