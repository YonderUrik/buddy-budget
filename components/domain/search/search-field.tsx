"use client";

/**
 * «Cerca» on desktop: a glass field above the page, at the right of its title (on the row of the «‹» back button),
 * that opens the search panel and shows its shortcut. It takes no height, so no page moves; it stays at hand while the
 * page scrolls under it and steps aside while the panel is open. Hidden on the phone (pull the page down instead).
 */

import * as React from "react";
import { SearchIcon } from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { useAppSearch } from "./search-provider";

const subscribeNoop = () => () => {};

export function SearchField() {
  const { t: tr } = useLocalization();
  const search = useAppSearch();
  // ⌘K on Apple devices, Ctrl K elsewhere.
  const shortcut = React.useSyncExternalStore(subscribeNoop, () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"), () => "⌘K");
  if (!search) return null;
  return (
    <div className="pointer-events-none sticky top-0 z-30 h-0 max-md:hidden">
      <div className="mx-auto flex max-w-6xl justify-end px-4 pt-5 sm:px-6">
        <button
          type="button"
          onClick={() => search.open("campo")}
          aria-haspopup="dialog"
          aria-keyshortcuts="Meta+K Control+K"
          tabIndex={search.isOpen ? -1 : undefined}
          className={cn(
            "pointer-events-auto flex h-10 w-72 cursor-pointer items-center gap-2.5 rounded-full border border-spotlight-edge bg-popover pr-1.5 pl-3.5 text-sm text-text-2 shadow-[inset_0_1px_0_var(--spotlight-highlight),0_10px_28px_-16px_var(--spotlight-shadow)] transition-[color,opacity] duration-150 hover:text-foreground supports-backdrop-filter:bg-spotlight supports-backdrop-filter:backdrop-blur-xl supports-backdrop-filter:backdrop-saturate-150",
            search.isOpen && "opacity-0"
          )}
        >
          <SearchIcon className="size-[18px] shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-left">{tr("Cerca o scrivi una frase")}</span>
          <kbd className="flex h-7 shrink-0 items-center rounded-full bg-foreground/[0.07] px-2.5 font-sans text-xs text-text-2">{shortcut}</kbd>
        </button>
      </div>
    </div>
  );
}
