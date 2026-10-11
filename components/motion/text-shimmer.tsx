/**
 * Testo che luccica mentre qualcosa è in corso (sync, import, calcoli): un riflesso attraversa le lettere in loop.
 * Idea di Text Shimmer di Motion Primitives (MIT), fatta in solo CSS (classe `text-shimmer` in globals.css): nessun
 * JavaScript per fotogramma. Con il movimento ridotto resta testo fermo in colore secondario.
 */

import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface TextShimmerProps {
  children: ReactNode;
  /** Elemento da usare (default `span`). */
  as?: ElementType;
  className?: string;
}

export function TextShimmer({ children, as: Tag = "span", className }: TextShimmerProps) {
  return <Tag className={cn("text-shimmer", className)}>{children}</Tag>;
}
