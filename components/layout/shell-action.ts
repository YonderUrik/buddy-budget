import type * as React from "react";

/**
 * A main action of the app (e.g. «Aggiungi») that the shell keeps always at hand: in the bottom bar on the phone and in
 * the sidebar on desktop. The shell only draws the button; what it opens belongs to whoever passes it.
 */
export interface ShellAction {
  /** Visible name (Italian source key, translated by the shell). */
  label: string;
  icon: React.ElementType;
  /** Called with the button that was pressed, so a panel can open next to it. */
  onClick: (anchor: HTMLElement) => void;
  /** Phone: a round button in the middle of the bottom bar, or beside the bar. Default: `center`. */
  placement?: "center" | "beside";
  /** Desktop sidebar: a full-width pill under the logo, or a round button next to the logo. Default: `pill`. */
  sidebar?: "pill" | "round";
  /** Key that also opens it on desktop, shown next to the label. */
  shortcut?: string;
}
