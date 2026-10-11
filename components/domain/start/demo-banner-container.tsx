"use client";

/** Mostra la striscia dei dati d'esempio in tutte le schermate dell'app finché ci sono. */

import { useClearDemoMutation, useStartQuery } from "@/lib/queries/start";
import { DemoBanner } from "./demo-banner";

export function DemoBannerContainer() {
  const { data } = useStartQuery();
  const clear = useClearDemoMutation();
  if (!data?.demoActive) return null;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
      <DemoBanner onClear={() => clear.mutate("banner")} pending={clear.isPending} errorMessage={clear.error?.message} />
    </div>
  );
}
