"use client";

/**
 * «Chiedi all'AI» under the category of one transaction: asks the model which category it would give and shows the
 * answer with «Usa questa». Hidden for transfers and on servers without the AI service; with the assistant off it
 * explains where to turn it on. Nothing changes until the user taps «Usa questa».
 */

import * as React from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { CategoryAvatar } from "@/components/domain/categories";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import type { SingleSuggestion } from "@/lib/categorization/ai/single-suggestion";
import type { Category } from "@/lib/db/schema/categories";
import { useLocalization } from "@/lib/localization/provider";
import { useAiCategorizationQuery } from "@/lib/queries/notifications";
import { useAiSuggestionMutation } from "@/lib/queries/transactions";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";

/** Where the assistant is turned on. */
const AI_SETTINGS_HREF = "/impostazioni#impostazioni-assistente-categorie";

export interface MovementDetailAiProps {
  transactionId: string;
  currentCategoryId: string;
  categories: readonly Category[];
  /** Saves the category the user accepted. */
  onUse: (categoryId: string) => void;
}

/** Text for an answer without a category, in the user's language. */
function noAnswerText(result: Exclude<SingleSuggestion, { status: "ok" }>, tr: (source: string) => string): string {
  switch (result.status) {
    case "limited":
      return tr("Hai chiesto molte volte nell'ultima ora: riprova più tardi.");
    case "disabled":
      return tr("L'assistente per le categorie è spento.");
    default:
      return tr("L'AI non ha risposto. Riprova tra poco.");
  }
}

export function MovementDetailAi({ transactionId, currentCategoryId, categories, onUse }: MovementDetailAiProps) {
  const { t: tr } = useLocalization();
  const settings = useAiCategorizationQuery();
  const ask = useAiSuggestionMutation();
  const [showOff, setShowOff] = React.useState(false);

  if (!settings.data?.available) return null;
  const enabled = settings.data.enabled;
  const result = ask.data;

  function onAsk() {
    if (!enabled) {
      setShowOff(true);
      return;
    }
    ask.mutate(transactionId);
  }

  const suggested = result?.status === "ok" ? categories.find((c) => c.id === result.categoryId) : undefined;
  const agrees = suggested?.id === currentCategoryId;

  if (result?.status === "ok" && suggested) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-primary/[0.07] p-3.5" aria-live="polite">
        <p className="flex items-center gap-1.5 text-sm text-text-2">
          <Sparkles className="size-4 text-primary" aria-hidden="true" />
          {agrees ? tr("L'AI è d'accordo con questa categoria") : tr("L'AI la metterebbe in")}
        </p>
        {agrees ? null : (
          <>
            <div className="flex items-center gap-3">
              <CategoryAvatar color={suggested.color as CategoryColor} icon={suggested.icon as CategoryIcon} size={18} className="size-10" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{suggested.name}</p>
                <p className="text-sm text-text-2">{tr("Sicura al {0}%", { 0: Math.round(result.confidence * 100) })}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="h-11 px-5"
                onClick={() => {
                  track("transaction_ai_used");
                  onUse(suggested.id);
                  ask.reset();
                }}
              >
                {tr("Usa questa")}
              </Button>
              <Button type="button" variant="ghost" className="h-11 px-4" onClick={() => ask.reset()}>
                {tr("Lascia così")}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }

  const message = showOff ? noAnswerText({ status: "disabled" }, tr) : result ? noAnswerText(result as Exclude<SingleSuggestion, { status: "ok" }>, tr) : ask.isError ? tr("L'AI non ha risposto. Riprova tra poco.") : null;
  return (
    <div className="flex flex-col items-start gap-2">
      <Button type="button" variant="outline" className="h-11 gap-2 px-4" onClick={onAsk} disabled={ask.isPending}>
        <Sparkles className="size-4" aria-hidden="true" />
        {ask.isPending ? tr("Chiedo all'AI…") : tr("Chiedi all'AI")}
      </Button>
      {message ? (
        <p className="text-sm text-text-2" aria-live="polite">
          {message}
          {showOff || result?.status === "disabled" ? (
            <>
              {" "}
              <Link href={AI_SETTINGS_HREF} className="font-medium text-foreground underline underline-offset-4">
                {tr("Accendilo in Impostazioni")}
              </Link>
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
