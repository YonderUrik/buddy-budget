"use client";

/** Scelta a pillola (es. «Nessuna data», «6 mesi»): un pulsante con `aria-pressed`, evidenziato quando è scelto. */

import * as React from "react";
import { cn } from "@/lib/utils";

export interface GoalChoiceProps extends Omit<React.ComponentProps<"button">, "type"> {
  selected: boolean;
}

export function GoalChoice({ selected, className, children, ...props }: GoalChoiceProps) {
  return (
    <button
      type="button"
      aria-pressed={props.role === "radio" ? undefined : selected}
      className={cn(
        "min-h-11 cursor-pointer rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:min-h-9",
        selected ? "border-primary bg-primary/10 text-primary" : "border-border text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
