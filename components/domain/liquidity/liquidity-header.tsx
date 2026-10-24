"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Liquidità heading: title (on the phone it opens the views), subtitle and the section's tabs.
 * Adding a movement, an account or a file goes through the app-wide «Aggiungi» (bottom bar, sidebar).
 */

import { SectionHeading, SectionTabs, type SectionTab } from "@/components/domain/shared";

export interface LiquidityHeaderProps {
  subtitle: string;
  tabs: readonly SectionTab[];
  activeHref: string;
}

export function LiquidityHeader({ subtitle, tabs, activeHref }: LiquidityHeaderProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex flex-col gap-4">
      <SectionHeading
        title={tr("Liquidità")}
        subtitle={tr(subtitle)}
        tabs={tabs}
        activeHref={activeHref}
        analyticsKey="liquidita"
        subtitleClassName="text-text-2"
      />
      <SectionTabs tabs={tabs} activeHref={activeHref} ariaLabel={tr("Sezioni di Liquidità")} />
    </div>
  );
}
