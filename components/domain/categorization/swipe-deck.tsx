"use client";

/**
 * Categorizzazione rapida «a carte»: una carta per esercente, si conferma la proposta o si sceglie un'altra
 * categoria (gesto, pulsanti o tastiera: → conferma, ← cambia, ↓ salta, Z annulla). Non crea mai regole da sola:
 * solo se l'utente spunta «Ricorda per questo esercente» sulla carta.
 */

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckIcon, ChevronsDownIcon, PencilIcon, Undo2Icon } from "lucide-react";
import { CategorySheet } from "@/components/domain/categories";
import { Button } from "@/components/ui/button";
import type { Category } from "@/lib/db/schema/categories";
import type { CategoryUsageCounts } from "@/lib/categories/picker";
import type { SuggestionGroup } from "@/lib/categorization/suggest";
import type { DeckDecision } from "@/lib/categorization/swipe-deck";
import { track } from "@/lib/analytics";
import { SPRING_SOFT } from "@/lib/motion/springs";
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

/** Come esce la carta in cima: di lato nella direzione del gesto, in fondo al mazzo se saltata, o «back» quando si annulla. */
type CardExit = "right" | "left" | "down" | "back";

/** Cosa serve alle varianti: come esce la carta in cima e, dopo un annulla, da che parte era uscita quella che torna. */
interface CardMotion {
  exit: CardExit;
  returnFrom?: CardExit;
}

/** Distanza (px) di cui la carta esce e durata dell'uscita: breve, perché la nuova carta sia subito pronta. */
const EXIT_TRAVEL_PX = 420;
const EXIT_SECONDS = 0.28;
const EXIT_TILT_DEGREES = 10;
/** Posizione della carta successiva, in attesa sotto quella attiva: la nuova carta parte da qui, così il passaggio è continuo. */
const WAITING_CARD = { scale: 0.95, y: 14 };
/** Curva dell'uscita: parte con lo slancio del gesto e rallenta uscendo. */
const EXIT_EASE = [0.25, 0.8, 0.4, 1] as const;

// Chi esce di lato passa sopra la carta nuova; chi torna nel mazzo (salta, annulla) le passa sotto, così i testi non si mescolano.
const CARD_VARIANTS = {
  // La carta nuova sale dal posto della carta in attesa; dopo un annulla rientra dal lato da cui era uscita, già piena.
  enter: ({ exit, returnFrom }: CardMotion) => {
    if (exit === "back" && returnFrom === "right") return { opacity: 1, x: EXIT_TRAVEL_PX, rotate: EXIT_TILT_DEGREES };
    if (exit === "back" && returnFrom === "left") return { opacity: 1, x: -EXIT_TRAVEL_PX, rotate: -EXIT_TILT_DEGREES };
    return { opacity: 1, ...WAITING_CARD };
  },
  center: { opacity: 1, scale: 1, x: 0, y: 0, rotate: 0 },
  exit: ({ exit }: CardMotion) => {
    const transition = { duration: EXIT_SECONDS, ease: EXIT_EASE };
    if (exit === "right") return { x: EXIT_TRAVEL_PX, rotate: EXIT_TILT_DEGREES, opacity: 0, zIndex: 20, transition };
    if (exit === "left") return { x: -EXIT_TRAVEL_PX, rotate: -EXIT_TILT_DEGREES, opacity: 0, zIndex: 20, transition };
    // Dopo un annulla la carta scende piena al posto della carta in attesa, che è lei stessa: nessuna doppia immagine.
    if (exit === "back") return { opacity: 1, ...WAITING_CARD, zIndex: 5, transition };
    return { opacity: 0, ...WAITING_CARD, zIndex: 5, transition };
  },
};

interface ActiveCardProps extends Omit<CategorizeSwipeDeckProps, "groups" | "onSave"> {
  group: SuggestionGroup;
  /** La carta successiva, mostrata in attesa sotto quella attiva. */
  nextGroup?: SuggestionGroup;
  remaining: number;
  canUndo: boolean;
  onDecide: (decision: Omit<DeckDecision, "groupKey">) => void;
  onSkip: () => void;
  onUndo: () => void;
}

/** La carta in cima con i suoi pulsanti e scorciatoie; `changing` e `remember` valgono per una carta sola (si azzerano al cambio di carta). */
function ActiveCard({ group, nextGroup, categories, currency, categoryUsage, remaining, canUndo, onDecide, onSkip, onUndo }: ActiveCardProps) {
  // Lo stato vale per una carta sola: al cambio di carta si azzera durante il render (il componente resta montato per animare l'uscita).
  const [local, setLocal] = React.useState({ key: group.groupKey, changing: false, remember: false });
  if (local.key !== group.groupKey) setLocal({ key: group.groupKey, changing: false, remember: false });
  const { changing, remember } = local;
  const setChanging = React.useCallback(
    (next: boolean | ((value: boolean) => boolean)) => setLocal((current) => ({ ...current, changing: typeof next === "function" ? next(current.changing) : next })),
    []
  );
  const setRemember = React.useCallback((next: boolean) => setLocal((current) => ({ ...current, remember: next })), []);
  const [exit, setExit] = React.useState<CardExit>("right");
  // Da che parte è uscita ogni carta decisa: con «Annulla» rientra da lì.
  const [exitByKey, setExitByKey] = React.useState<Record<string, CardExit>>({});
  const cardMotion: CardMotion = { exit, returnFrom: exit === "back" ? exitByKey[group.groupKey] : undefined };
  const leave = React.useCallback(
    (direction: CardExit) => {
      setExit(direction);
      setExitByKey((current) => ({ ...current, [group.groupKey]: direction }));
    },
    [group.groupKey]
  );
  const suggestion = group.suggestion;
  const suggested = suggestion ? categories.find((c) => c.id === suggestion.suggestedCategoryId) : undefined;
  const suggestedName = suggested?.name;
  const suggestedAppearance = suggested ? { icon: suggested.icon as CategoryIcon, color: suggested.color as CategoryColor } : undefined;

  const isIncome = group.totalAmount > 0;
  // Nel foglio solo le categorie della stessa direzione, senza quella già proposta (l'utente ha appena detto che non va).
  const selectable = React.useMemo(
    () => categories.filter((c) => !c.isFallback && c.id !== suggestion?.suggestedCategoryId && (c.type === "trasferimento" || (isIncome ? c.type === "entrata" : c.type !== "entrata"))),
    [categories, isIncome, suggestion]
  );

  const confirm = React.useCallback(() => {
    if (!suggestion) return;
    leave("right");
    onDecide({ categoryId: suggestion.suggestedCategoryId, remember, excludedPercentage: suggestion.suggestedSplitPercentage ?? 0, action: "conferma" });
    track("categorize_card_decided", { action: "conferma", source: suggestion.source, remember });
  }, [suggestion, onDecide, remember, leave]);

  const pick = React.useCallback(
    (categoryId: string) => {
      leave("left");
      onDecide({ categoryId, remember, excludedPercentage: 0, action: "cambia" });
      track("categorize_card_decided", { action: "cambia", source: suggestion?.source ?? "nessuna", remember });
    },
    [suggestion, onDecide, remember, leave]
  );

  const skipCard = React.useCallback(() => {
    leave("down");
    onSkip();
    track("categorize_card_decided", { action: "salta", source: suggestion?.source ?? "nessuna", remember: false });
  }, [onSkip, suggestion, leave]);

  const undoCard = React.useCallback(() => {
    setExit("back");
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
  }, [suggestion, changing, setChanging, canUndo, confirm, skipCard, undoCard]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-4 max-md:flex-1">
      <p className="text-center text-xs text-muted-foreground tabular-nums max-md:-mb-2" aria-live="polite">
        {remaining === 1 ? "Ultima carta" : `${remaining} esercenti da categorizzare`}
      </p>
      <div className="relative flex flex-col max-md:flex-1">
        {remaining > 2 && <div className="absolute inset-x-5 -bottom-4 h-10 rounded-2xl border border-border bg-card/60" aria-hidden />}
        {nextGroup && (
          <div key={nextGroup.groupKey} inert aria-hidden className="absolute inset-0 flex flex-col overflow-hidden rounded-2xl" style={{ transform: `translateY(${WAITING_CARD.y}px) scale(${WAITING_CARD.scale})` }}>
            <WaitingCard group={nextGroup} categories={categories} currency={currency} />
          </div>
        )}
        <AnimatePresence mode="popLayout" custom={cardMotion} initial={false}>
          <motion.div
            key={group.groupKey}
            custom={cardMotion}
            variants={CARD_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={SPRING_SOFT}
            className="relative z-10 flex flex-col max-md:flex-1"
          >
            <SwipeCard
              group={group}
              currency={currency}
              suggestedName={suggestedName}
              suggestedAppearance={suggestedAppearance}
              changing={changing}
              remember={remember}
              onRememberChange={setRemember}
              onConfirm={confirm}
              onChange={() => setChanging(true)}
              onSkip={skipCard}
            />
          </motion.div>
        </AnimatePresence>
      </div>
      <CategorySheet
        open={changing}
        onOpenChange={setChanging}
        categories={selectable}
        usage={categoryUsage}
        description={group.label}
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

/** La carta successiva com'è quando arriverà in cima, ferma e non interattiva. */
function WaitingCard({ group, categories, currency }: { group: SuggestionGroup; categories: Category[]; currency: string }) {
  const suggested = group.suggestion ? categories.find((c) => c.id === group.suggestion?.suggestedCategoryId) : undefined;
  return (
    <SwipeCard
      group={group}
      currency={currency}
      suggestedName={suggested?.name}
      suggestedAppearance={suggested ? { icon: suggested.icon as CategoryIcon, color: suggested.color as CategoryColor } : undefined}
      changing={false}
      remember={false}
      onRememberChange={() => {}}
      onConfirm={() => {}}
      onChange={() => {}}
      onSkip={() => {}}
    />
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
      group={deck.top}
      nextGroup={deck.next}
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
