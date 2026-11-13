"use client";
import { useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/lib/localization/provider";
import { IbkrFlexSettings } from "./ibkr-flex-step-parts";
import { IBKR_FLEX_QUERY_SETTINGS, IBKR_FLEX_SECTIONS } from "./ibkr-flex-text";

/** How long «Copiato» stays on the copy button. */
const COPIED_FEEDBACK_MS = 2000;

export interface IbkrFlexQueryStepProps {
  onNext: () => void;
}

/** Step 1: where to create the Activity Flex Query, its three settings and the nine sections, with a copy button. */
export function IbkrFlexQueryStep({ onNext }: IbkrFlexQueryStepProps) {
  const { t } = useLocalization();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(IBKR_FLEX_SECTIONS.join(", "));
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    } catch { /* clipboard refused: the list stays readable on screen */ }
  };
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-text-2">
        {t("Nel Client Portal apri")} <b className="font-semibold text-foreground">Performance &amp; Reports → Flex Queries</b> {t("e premi + accanto ad")} <b className="font-semibold text-foreground">Activity Flex Query</b>. {t("Scegli:")}
      </p>
      <IbkrFlexSettings rows={IBKR_FLEX_QUERY_SETTINGS} />
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-foreground">{t("Spunta queste {0} sezioni, con «Select All»", { 0: IBKR_FLEX_SECTIONS.length })}</p>
          <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline" aria-live="polite">
            {copied ? <CheckIcon className="size-4" aria-hidden="true" /> : <CopyIcon className="size-4" aria-hidden="true" />}
            {copied ? t("Copiato") : t("Copia elenco")}
          </button>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {IBKR_FLEX_SECTIONS.map((section) => <li key={section} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">{section}</li>)}
        </ul>
      </div>
      <Button type="button" variant="sun" className="mt-2 h-11" onClick={onNext}>{t("Fatto, avanti")}</Button>
    </div>
  );
}
