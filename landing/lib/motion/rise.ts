import type { CSSProperties } from "react";

/**
 * Order of an element in its section's entrance (`data-rise`): each step starts 75 ms after the previous one
 * (`--i` in `globals.css`). Pass the result as `style`.
 */
export function rise(order: number): CSSProperties {
  return { "--i": order } as CSSProperties;
}
