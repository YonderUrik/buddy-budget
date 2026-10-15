"use client";

/** Icona tonda di un obiettivo, tinta nel colore del suo tipo (stessa formula delle sezioni della Panoramica). */

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GoalIconProps {
  icon: LucideIcon;
  color: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE = { sm: "size-8 [&_svg]:size-4", md: "size-10 [&_svg]:size-5", lg: "size-14 [&_svg]:size-7" } as const;

export function GoalIcon({ icon: Icon, color, size = "md", className }: GoalIconProps) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-full", SIZE[size], className)} style={{ color, backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)` }} aria-hidden="true">
      <Icon />
    </span>
  );
}
