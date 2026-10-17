import * as React from "react";
import { cn } from "@/lib/utils";

export interface HeroFieldProps extends React.ComponentProps<"div"> {
  /** Pulls the field up to the top edge of the page (for a screen that opens on it, like Panoramica). */
  flush?: boolean;
}

/**
 * The opening of a screen as a navy colour field, edge to edge of the content column (taste-skill: «a section may change
 * the whole field colour»). Inside it the dark tokens apply, tinted towards navy, so figures, charts and controls keep
 * their contrast without per-component colours.
 */
export function HeroField({ flush = false, className, ...props }: HeroFieldProps) {
  return (
    <div
      data-hero-field=""
      className={cn("dark py-8 sm:py-10", flush && "-mt-4 sm:-mt-6", className)}
      {...props}
    />
  );
}
