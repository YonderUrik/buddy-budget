import type * as React from "react";

/** Where the shell drew the button that was pressed, or the gesture that opened the action («pull»: the page pulled down). */
export type ShellActionOrigin = "bottom-bar" | "sidebar" | "more-menu" | "pull";

/**
 * A main action of the app (e.g. «Aggiungi») that the shell keeps always at hand: a round button in the middle of the
 * bottom bar on the phone and a pill under the logo in the sidebar. The shell only draws the button; what it opens
 * belongs to whoever passes it.
 */
export interface ShellAction {
  /** Visible name (Italian source key, translated by the shell). */
  label: string;
  icon: React.ElementType;
  /** Called with the button that was pressed (a panel can open next to it) and where that button is. */
  onClick: (anchor: HTMLElement, origin: ShellActionOrigin) => void;
}
