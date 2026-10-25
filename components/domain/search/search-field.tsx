"use client";

/**
 * «Cerca» on desktop: a glass field above the page, outside the sidebar, that opens the search panel and shows its
 * shortcut. It stays at hand while the page scrolls under it and steps aside while the panel is open.
 *
 * Prototype: two places to compare, picked with `localStorage["bb-search-field"]`: "destra" (default, at the right of
 * the page title, over the page) or "centro" (a wide field centred on its own row above the page).
 */

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { useAppSearch } from "./search-provider";

type FieldPlace = "destra" | "centro";
const PLACE_KEY = "bb-search-field";
const subscribeNoop = () => () => {};

function readPlace(): FieldPlace {
  try {
    return window.localStorage.getItem(PLACE_KEY) === "centro" ? "centro" : "destra";
  } catch {
    return "destra";
  }
}

export function SearchField() {
  const { t: tr } = useLocalization();
  const search = useAppSearch();
  const place = React.useSyncExternalStore(subscribeNoop, readPlace, () => "destra" as FieldPlace);
  // ⌘K on Apple devices, Ctrl K elsewhere.
  const shortcut = React.useSyncExternalStore(subscribeNoop, () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"), () => "⌘K");
  if (!search) return null;
  const centred = place === "centro";

  const field = (
    <button
      type="button"
      onClick={() => search.open("campo")}
      aria-haspopup="dialog"
      aria-keyshortcuts="Meta+K Control+K"
      tabIndex={search.isOpen ? -1 : undefined}
      className={cn(
        "pointer-events-auto flex cursor-pointer items-center rounded-full border border-spotlight-edge bg-popover text-text-2 shadow-[inset_0_1px_0_var(--spotlight-highlight),0_10px_28px_-16px_var(--spotlight-shadow)] transition-[color,opacity] duration-150 hover:text-foreground supports-backdrop-filter:bg-spotlight supports-backdrop-filter:backdrop-blur-xl supports-backdrop-filter:backdrop-saturate-150",
        centred ? "h-12 w-[min(480px,100%)] gap-3 pr-2 pl-4 text-[15px]" : "h-10 w-72 gap-2.5 pr-1.5 pl-3.5 text-sm",
        search.isOpen && "opacity-0"
      )}
    >
      <SearchIcon className={centred ? "size-5 shrink-0" : "size-[18px] shrink-0"} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-left">{tr("Cerca o scrivi una frase")}</span>
      <kbd className="flex h-7 shrink-0 items-center rounded-full bg-foreground/[0.07] px-2.5 font-sans text-xs text-text-2">{shortcut}</kbd>
    </button>
  );

  if (centred) {
    return (
      <div className="pointer-events-none sticky top-0 z-30 max-md:hidden">
        <div className="mx-auto flex max-w-6xl justify-center px-4 pt-4 sm:px-6">{field}</div>
      </div>
    );
  }
  // No height of its own: the field sits over the page, at the right of its title, and the page keeps its place.
  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0 max-md:hidden">
      <div className="mx-auto flex max-w-6xl justify-end px-4 pt-5 sm:px-6">{field}</div>
    </div>
  );
}
