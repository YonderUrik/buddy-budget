"use client";

/**
 * Categorizzazione rapida «a carte»: una carta per esercente, si conferma la proposta o si sceglie un'altra
 * categoria (gesto, pulsanti o tastiera: → conferma, ← cambia, ↓ salta, Z annulla). Non crea mai regole da sola:
 * solo se l'utente spunta «Ricorda per questo esercente» sulla carta.
 */

import * as React from "react";
import { CheckIcon, ChevronsDownIcon, PencilIcon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import type { DeckDecision } from "@/lib/categorization/swipe-deck";
import { track } from "@/lib/analytics";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { SwipeCard } from "./swipe-card";
import { SwipeTour } from "./swipe-tour";
import { useSwipeDeck } from "./use-swipe-deck";

export interface CategorizeSwipeDeckProps {
  groups: SuggestionGroup[];
  categories: Category[];
  currency: string;
  categoryUsage?: CategoryUsageCounts;
  onSave: (decisions: DeckDecision[]) => Promise<void>;
}

/** Vero se il tasto premuto arriva da un campo in cui si sta scrivendo o da un menu aperto. */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.closest('[role="listbox"], [role="dialog"]') !== null;
}

interface ActiveCardProps extends Omit<CategorizeSwipeDeckProps, "groups" | "onSave"> {
  group: SuggestionGroup;
  remaining: number;
  canUndo: boolean;
  onDecide: (decision: Omit<DeckDecision, "groupKey">) => void;
  onSkip: () => void;
  onUndo: () => void;
}

/** La carta in cima con i suoi pulsanti e scorciatoie; `changing` e `remember` valgono per una carta sola (la si rimonta con `key`). */
function ActiveCard({ group, categories, currency, categoryUsage, remaining, canUndo, onDecide, onSkip, onUndo }: ActiveCardProps) {
  const [changing, setChanging] = React.useState(false);
  const [remember, setRemember] = React.useState(false);
  const suggestion = group.suggestion;
  const suggested = suggestion ? categories.find((c) => c.id === suggestion.suggestedCategoryId) : undefined;
  const suggestedName = suggested?.name;
  const suggestedAppearance = suggested ? { icon: suggested.icon as CategoryIcon, color: suggested.color as CategoryColor } : undefined;

  const confirm = React.useCallback(() => {
    if (!suggestion) return;
    onDecide({ categoryId: suggestion.suggestedCategoryId, remember, excludedPercentage: suggestion.suggestedSplitPercentage ?? 0, action: "conferma" });
    track("categorize_card_decided", { action: "conferma", source: suggestion.source, remember });
  }, [suggestion, onDecide, remember]);

  const pick = React.useCallback(
    (categoryId: string) => {
      onDecide({ categoryId, remember, excludedPercentage: 0, action: "cambia" });
      track("categorize_card_decided", { action: "cambia", source: suggestion?.source ?? "nessuna", remember });
    },
    [suggestion, onDecide, remember]
  );

  const skipCard = React.useCallback(() => {
    onSkip();
    track("categorize_card_decided", { action: "salta", source: suggestion?.source ?? "nessuna", remember: false });
  }, [onSkip, suggestion]);

  const undoCard = React.useCallback(() => {
    onUndo();
    track("categorize_card_decided", { action: "annulla", source: "nessuna", remember: false });
  }, [onUndo]);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "ArrowRight" || event.key === "Enter") {
        if (suggestion && !changing) { event.preventDefault(); confirm(); }
      } else if (event.key === "ArrowLeft") {
        event.preventDefault(); setChanging(true);
      } else if (event.key === "ArrowDown") {
        event.preventDefault(); skipCard();
      } else if (event.key.toLowerCase() === "z" || event.key === "Backspace") {
        if (canUndo) { event.preventDefault(); undoCard(); }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [suggestion, changing, canUndo, confirm, skipCard, undoCard]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 max-md:flex-1">
      <p className="text-center text-xs text-muted-foreground tabular-nums max-md:-mb-2" aria-live="polite">
        {remaining === 1 ? "Ultima carta" : `${remaining} esercenti da categorizzare`}
      </p>
      <SwipeCard
        group={group}
        currency={currency}
        categories={categories}
        categoryUsage={categoryUsage}
        suggestedName={suggestedName}
        suggestedAppearance={suggestedAppearance}
        changing={changing}
        remember={remember}
        onRememberChange={setRemember}
        onConfirm={confirm}
        onChange={() => setChanging(true)}
        onSkip={skipCard}
        onPick={pick}
      />
      <div className="flex items-center justify-center gap-3 max-md:pb-1">
        <Button type="button" variant="ghost" size="icon" onClick={undoCard} disabled={!canUndo} aria-label="Annulla l'ultima scelta" title="Annulla (Z)">
          <Undo2Icon />
        </Button>
        <Button type="button" variant="outline" className="h-11 flex-1" onClick={() => setChanging((value) => !value)} title="Un'altra categoria (←)">
          <PencilIcon /> {changing ? "Torna alla proposta" : "Cambia"}
        </Button>
        {suggestion && !changing && (
          <Button type="button" className="h-11 flex-1" onClick={confirm} title="Conferma (→ o Invio)">
            <CheckIcon /> Conferma
          </Button>
        )}
        <Button type="button" variant="ghost" size="icon" onClick={skipCard} aria-label="Salta per ora" title="Salta (↓)">
          <ChevronsDownIcon />
        </Button>
      </div>
      <p className="hidden text-center text-xs text-muted-foreground sm:block">
        Frecce: → conferma, ← cambia, ↓ salta, Z annulla. Le scelte si salvano da sole dopo qualche secondo.
      </p>
      <SwipeTour />
    </div>
  );
}

export function CategorizeSwipeDeck({ groups, categories, currency, categoryUsage, onSave }: CategorizeSwipeDeckProps) {
  const deck = useSwipeDeck({ groups, onSave });
  if (!deck.top) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border p-8 text-center">
        <p className="font-heading text-lg font-medium text-foreground">Fatto, non c&apos;è altro da categorizzare</p>
        {deck.canUndo && (
          <Button type="button" variant="ghost" size="sm" onClick={deck.undo}>
            <Undo2Icon /> Annulla l&apos;ultima scelta
          </Button>
        )}
      </div>
    );
  }
  return (
    <ActiveCard
      key={deck.top.groupKey}
      group={deck.top}
      categories={categories}
      currency={currency}
      categoryUsage={categoryUsage}
      remaining={deck.remaining}
      canUndo={deck.canUndo}
      onDecide={deck.decide}
      onSkip={deck.skip}
      onUndo={deck.undo}
    />
  );
}
