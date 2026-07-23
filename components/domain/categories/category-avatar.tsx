/** Avatar categoria: icona Lucide su cerchio colorato (stessa palette colori dei conti, icone dedicate alle spese). */

import * as React from "react";
import {
  Utensils, ShoppingCart, Home, Zap, Droplet, Wifi, Tv, Smartphone,
  Car, Bus, Plane, Fuel, Film, Gamepad2, Music, Heart, Stethoscope,
  Dumbbell, GraduationCap, Baby, PawPrint, Shirt, Scissors, Gift,
  Briefcase, Wrench, Package, HelpCircle,
  Wallet, CreditCard, PiggyBank, Banknote, Landmark, Receipt,
  TrendingUp, Coins, Flame, Sofa, Hammer, Paintbrush,
  Laptop, Headphones, Camera, Printer, TrainFront, Ship,
  MapPin, Luggage, Coffee, Pizza, Wine, Cake, Pill,
  Activity, Glasses, BookOpen, Palette, Bike, Calculator,
  Watch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { COLOR_SWATCH_MAP } from "@/components/domain/shared/color-swatches";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

export const ICON_MAP: Record<CategoryIcon, LucideIcon> = {
  utensils: Utensils,
  "shopping-cart": ShoppingCart,
  home: Home,
  zap: Zap,
  droplet: Droplet,
  wifi: Wifi,
  tv: Tv,
  smartphone: Smartphone,
  car: Car,
  bus: Bus,
  plane: Plane,
  fuel: Fuel,
  film: Film,
  "gamepad-2": Gamepad2,
  music: Music,
  heart: Heart,
  stethoscope: Stethoscope,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  baby: Baby,
  "paw-print": PawPrint,
  shirt: Shirt,
  scissors: Scissors,
  gift: Gift,
  briefcase: Briefcase,
  wrench: Wrench,
  package: Package,
  "help-circle": HelpCircle,
  wallet: Wallet,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  banknote: Banknote,
  landmark: Landmark,
  receipt: Receipt,
  "trending-up": TrendingUp,
  coins: Coins,
  flame: Flame,
  sofa: Sofa,
  hammer: Hammer,
  paintbrush: Paintbrush,
  laptop: Laptop,
  headphones: Headphones,
  camera: Camera,
  printer: Printer,
  "train-front": TrainFront,
  ship: Ship,
  "map-pin": MapPin,
  luggage: Luggage,
  coffee: Coffee,
  pizza: Pizza,
  wine: Wine,
  cake: Cake,
  pill: Pill,
  activity: Activity,
  glasses: Glasses,
  "book-open": BookOpen,
  palette: Palette,
  bike: Bike,
  calculator: Calculator,
  watch: Watch,
};

export interface CategoryAvatarProps {
  color: CategoryColor;
  icon: CategoryIcon;
  size?: number;
  className?: string;
}

export function CategoryAvatar({ color, icon, size = 16, className }: CategoryAvatarProps) {
  const Icon = ICON_MAP[icon] ?? Package;
  const { bg, fg } = COLOR_SWATCH_MAP[color] ?? COLOR_SWATCH_MAP.slate;

  return (
    <div
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", bg, className)}
      aria-hidden="true"
    >
      <Icon size={size} className={fg} />
    </div>
  );
}
