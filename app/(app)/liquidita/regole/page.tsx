"use client";

/** Liquidità · Regole: le regole che assegnano da sole la categoria ai movimenti riconosciuti. */

import * as React from "react";
import { usePathname } from "next/navigation";
import { WandSparklesIcon } from "lucide-react";
import { RulesManager } from "@/components/domain/categorization";
import { LIQUIDITY_HREF, ManagementSwitch, SectionTitle } from "@/components/domain/liquidity";
import { LoadError } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { useCategoriesQuery } from "@/lib/queries/categories";

const OPTIONS = [
  { href: `${LIQUIDITY_HREF}/categorie`, label: "Categorie" },
  { href: `${LIQUIDITY_HREF}/regole`, label: "Regole" },
] as const;

export default function LiquiditaRegolePage() {
  const pathname = usePathname();
  const { data: categories, isLoading, isError, refetch } = useCategoriesQuery();

  React.useEffect(() => track("liquidity_tab_viewed", { tab: "regole" }), []);

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <ManagementSwitch options={OPTIONS} activeHref={pathname} />
      <section>
        <SectionTitle icon={WandSparklesIcon} title="Regole automatiche" color="var(--swatch-purple)" />
        <p className="mb-4 text-sm text-text-2">Le regole assegnano da sole la categoria ai movimenti che riconoscono.</p>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
        ) : isError ? (
          <LoadError message="Impossibile caricare le categorie." onRetry={() => refetch()} />
        ) : (
          <RulesManager categories={categories ?? []} />
        )}
      </section>
    </div>
  );
}
