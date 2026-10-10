"use client";

/** Versione mobile di `SectionTabs`: un menu a tendina con la vista attiva, il suo numero d'ordine e tutte le altre. */

import Link from "next/link";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SectionTab } from "./section-tabs";

const MENU_ICON_SIZE = 18;

export interface SectionTabsMenuProps {
  tabs: readonly SectionTab[];
  activeIndex: number;
  ariaLabel: string;
}

export function SectionTabsMenu({ tabs, activeIndex, ariaLabel }: SectionTabsMenuProps) {
  const active = tabs[activeIndex];
  if (!active) return null;
  const ActiveIcon = active.icon;
  return (
    <nav aria-label={ariaLabel}>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex min-h-12 w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-background px-3.5 text-left text-base font-medium text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {ActiveIcon ? <ActiveIcon size={MENU_ICON_SIZE} aria-hidden="true" className="shrink-0 text-primary" /> : null}
          <span className="min-w-0 flex-1 truncate">{active.label}</span>
          <span className="text-xs font-normal text-muted-foreground">
            {activeIndex + 1} di {tabs.length}
          </span>
          <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={6} className="rounded-xl p-1.5">
          {tabs.map((tab, index) => {
            const isActive = index === activeIndex;
            const Icon = tab.icon;
            return (
              <DropdownMenuItem
                key={tab.href}
                render={<Link href={tab.href} aria-current={isActive ? "page" : undefined} />}
                className={cn("min-h-12 gap-3 rounded-lg px-2.5 py-2", isActive && "bg-muted")}
              >
                {Icon ? (
                  <Icon size={MENU_ICON_SIZE} aria-hidden="true" className={isActive ? "text-primary" : "text-muted-foreground"} />
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-base font-medium">{tab.label}</span>
                  {tab.description ? <span className="text-xs text-muted-foreground">{tab.description}</span> : null}
                </span>
                {isActive ? <CheckIcon className="size-4 text-primary" aria-hidden="true" /> : null}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
