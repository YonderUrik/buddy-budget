"use client";

/** Liquidità · Categorie: board per gruppo (crea, sposta, modifica, elimina; colori automatici). */

import * as React from "react";
import { usePathname } from "next/navigation";
import { TagsIcon } from "lucide-react";
import { CategoryBoard, DistributeColorsButton } from "@/components/domain/categories";
import { LIQUIDITY_HREF, ManagementSwitch, SectionTitle } from "@/components/domain/liquidity";
import { LoadError } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import { authClient } from "@/lib/auth/client";
import { useCategoriesQuery } from "@/lib/queries/categories";

const OPTIONS = [
  { href: `${LIQUIDITY_HREF}/categorie`, label: "Categorie" },
  { href: `${LIQUIDITY_HREF}/regole`, label: "Regole" },
] as const;

export default function LiquiditaCategoriePage() {
  const pathname = usePathname();
  const { data: categories, isLoading, isError, refetch } = useCategoriesQuery();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";

  React.useEffect(() => track("liquidity_tab_viewed", { tab: "categorie" }), []);

  return (
    <div className="flex flex-col gap-6">
      <ManagementSwitch options={OPTIONS} activeHref={pathname} />
      <section>
        <SectionTitle icon={TagsIcon} title="Le tue categorie" color="var(--swatch-teal)" />
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text-2">Trascina una categoria in un altro gruppo, oppure toccala per modificarla.</p>
          <DistributeColorsButton />
        </div>
        {isLoading ? (
          <div className="h-48 animate-pulse rounded-2xl bg-muted" aria-busy="true" />
        ) : isError ? (
          <LoadError message="Impossibile caricare le categorie." onRetry={() => refetch()} />
        ) : (
          <CategoryBoard categories={categories ?? []} currency={currency} />
        )}
      </section>
    </div>
  );
}
