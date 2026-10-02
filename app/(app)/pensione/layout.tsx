"use client";

/** Layout di Pensione (prototipo): titolo, avviso sui dati d'esempio e schede. */

import * as React from "react";
import { usePathname } from "next/navigation";
import { PENSION_TABS } from "@/components/domain/pension";
import { SectionTabs } from "@/components/domain/shared";
import { Button } from "@/components/ui/button";
import { usePensionPrototype } from "@/lib/pension/use-pension-prototype";

export default function PensioneLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const store = usePensionPrototype();
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5 p-4 sm:gap-6 sm:p-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="font-heading text-2xl font-medium text-foreground">Pensione</h1>
          <p className="text-sm text-muted-foreground">Il tuo fondo pensione: quanto rende, quanto ti resterebbe e dove arriverà</p>
        </div>
        <SectionTabs tabs={PENSION_TABS} activeHref={pathname} ariaLabel="Sezioni di Pensione" />
      </div>
      {store.isDemo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/50 px-4 py-3">
          <p className="text-sm text-foreground">Stai guardando <strong className="font-medium">dati d&apos;esempio</strong>. Prova a cambiarli o inserisci i tuoi.</p>
          <Button size="sm" variant="outline" onClick={store.startEmpty}>Inserisci i miei dati</Button>
        </div>
      ) : null}
      {children}
      <p className="text-xs text-muted-foreground">Stime a scopo informativo, non consulenza finanziaria o fiscale: regole e aliquote vanno verificate con un professionista.</p>
    </div>
  );
}
