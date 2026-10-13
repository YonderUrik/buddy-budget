"use client";

/**
 * Contenuto del passo «Categorie» dell'onboarding: le categorie proposte come etichette per gruppo e «Personalizza», che
 * apre il foglio per spegnerle, rinominarle o aggiungerne. Non obbliga a nulla: si può proseguire con la proposta.
 */

import * as React from "react";
import dynamic from "next/dynamic";
import { Info, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepHeading } from "@/components/domain/shared";
import { track } from "@/lib/analytics";
import type { UseCategorySetupResult } from "./use-category-setup";
import { CategorySetupSummary } from "./category-setup-summary";

const CategorySetupSheet = dynamic(() => import("./category-setup-sheet").then((module) => module.CategorySetupSheet), { ssr: false });

export interface CategorySetupStepProps {
  setup: UseCategorySetupResult;
  disabled?: boolean;
  /** Dove ritrovarle dopo l'onboarding. */
  laterHint?: string;
}

export function CategorySetupStep({ setup, disabled = false, laterHint = "Le ritrovi e le cambi quando vuoi in Liquidità → Categorie." }: CategorySetupStepProps) {
  const [open, setOpen] = React.useState(false);
  const activeCount = setup.items.filter((item) => item.enabled).length;

  return (
    <>
      <StepHeading
        title="Ecco le categorie per i tuoi movimenti"
        description={
          setup.customized
            ? `Ne userai ${activeCount}, divise per tipo di spesa.`
            : `Ne abbiamo preparate ${activeCount}, divise per tipo di spesa. Puoi iniziare con queste.`
        }
      />
      <CategorySetupSummary items={setup.items} />
      {setup.problem && (
        <p className="rounded-lg bg-neg-soft p-3 text-sm text-neg" role="alert">
          {setup.problem} Correggilo in «Personalizza», o prosegui con le categorie proposte.
        </p>
      )}
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => {
            track("onboarding_categories_opened");
            setOpen(true);
          }}
          className="h-11 cursor-pointer self-stretch sm:h-9 sm:self-start"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Personalizza
        </Button>
        <p className="flex items-center gap-1.5 text-xs text-text-3">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          {laterHint}
        </p>
      </div>
      {open && <CategorySetupSheet open={open} onOpenChange={setOpen} setup={setup} />}
    </>
  );
}
