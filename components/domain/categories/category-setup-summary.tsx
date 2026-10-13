"use client";
import { useLocalization } from "@/lib/localization/provider";

/** Riepilogo del passo «Categorie» dell'onboarding: le categorie accese come etichette, divise per gruppo. */

import type { CategoryProposalItem } from "@/lib/categories/setup";
import { cn } from "@/lib/utils";
import { CategoryAvatar } from "./category-avatar";
import { SETUP_GROUPS } from "./category-setup-groups";

export interface CategorySetupSummaryProps {
  items: CategoryProposalItem[];
  className?: string;
}

export function CategorySetupSummary({ items, className }: CategorySetupSummaryProps) {
  const { t: tr } = useLocalization();
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {SETUP_GROUPS.map((group) => {
        const active = items.filter((item) => item.enabled && item.type === group.type);
        if (active.length === 0) return null;
        return (
          <section key={group.type} aria-label={tr(group.label)} className="flex flex-col gap-2">
            <h3 className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <span className={cn("size-2 rounded-full", group.dotClassName)} aria-hidden="true" />
              {tr(group.label)}
              <span className="text-text-3">· {active.length}</span>
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {active.map((item) => (
                <li
                  key={item.key ?? `nuova-${item.name}`}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-sm"
                >
                  <CategoryAvatar color={item.color} icon={item.icon} size={13} className="size-6" />
                  {item.name.trim()}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
