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
import { COLOR_SWATCH_MAP } from "@/components/domain/shared/color-swatches";

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
  const { bg, fg } = COLOR_SWATCH_MAP[color] ?? COLOR_SWATCH_MAP.slate;

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
