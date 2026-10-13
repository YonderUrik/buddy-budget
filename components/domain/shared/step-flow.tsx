"use client";

/**
 * Pezzi comuni dei form «a passi»: un'unica domanda alla volta, avanzamento visibile, indietro sempre disponibile.
 * `useStepFlow` tiene lo stato, `StepProgress` dice a che punto sei, `StepStage` anima il cambio di passo (scorre di
 * poco e dissolve; con il movimento ridotto resta la sola dissolvenza) e porta il focus sul primo campo, `StepActions`
 * è la riga con «Indietro» e il pulsante principale.
 */

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SPRING_SNAPPY } from "@/lib/motion/springs";
import { initialStepFlow, stepFlowReducer, type StepDirection, type StepFlowState } from "./step-flow.state";

/** Spostamento orizzontale (px) dei passi che entrano e escono: abbastanza per dare il verso, non per distrarre. */
const STEP_SHIFT_PX = 14;
const STEP_FADE_SECONDS = 0.16;
/** Primo elemento su cui portare il focus quando compare un passo (si può forzare con `data-autofocus`). */
const FOCUS_SELECTOR = "[data-autofocus], input:not([type=hidden]):not([disabled]), textarea:not([disabled]), [role=radio][aria-checked=true], button:not([disabled])";

export interface UseStepFlowResult extends StepFlowState {
  count: number;
  isFirst: boolean;
  isLast: boolean;
  next: () => void;
  back: () => void;
  goTo: (index: number) => void;
}

/** Stato di un percorso di `count` passi. Chi chiama decide quando `next()` è lecito (validazione) e cosa fa `back()` al primo passo. */
export function useStepFlow(count: number, startIndex = 0): UseStepFlowResult {
  const reducer = React.useMemo(() => stepFlowReducer(count), [count]);
  const [state, dispatch] = React.useReducer(reducer, undefined, () => initialStepFlow(count, startIndex));
  return {
    ...state,
    count,
    isFirst: state.index === 0,
    isLast: state.index === count - 1,
    next: React.useCallback(() => dispatch({ type: "next" }), []),
    back: React.useCallback(() => dispatch({ type: "back" }), []),
    goTo: React.useCallback((index: number) => dispatch({ type: "goTo", index }), []),
  };
}

export interface StepProgressProps {
  index: number;
  count: number;
  /** Nome del percorso, per l'etichetta accessibile (es. «Nuovo conto»). */
  label: string;
  className?: string;
}

/** «Passo 2 di 3» con una barra a segmenti: i segmenti fatti si riempiono con una molla. */
export function StepProgress({ index, count, label, className }: StepProgressProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className="text-xs font-medium text-muted-foreground" aria-live="polite">
        Passo {index + 1} di {count}
      </p>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={1}
        aria-valuemax={count}
        aria-valuenow={index + 1}
        aria-valuetext={`Passo ${index + 1} di ${count}`}
        className="flex gap-1.5"
      >
        {Array.from({ length: count }, (_, i) => (
          <span key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
            <motion.span
              className="absolute inset-0 origin-left rounded-full bg-primary"
              initial={false}
              animate={{ scaleX: i <= index ? 1 : 0 }}
              transition={SPRING_SNAPPY}
            />
          </span>
        ))}
      </div>
    </div>
  );
}

export interface StepStageProps {
  /** Chiave del passo corrente: cambia quando cambia il passo. */
  stepKey: string | number;
  direction: StepDirection;
  children: React.ReactNode;
  className?: string;
}

/** Contenitore del passo corrente: anima l'uscita e l'ingresso e porta il focus sul primo campo del nuovo passo. */
export function StepStage({ stepKey, direction, children, className }: StepStageProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const initialKey = React.useRef(stepKey);
  const moved = React.useRef(false);
  React.useEffect(() => {
    if (stepKey !== initialKey.current) moved.current = true;
  }, [stepKey]);
  // Il focus va al primo campo quando il nuovo passo è entrato (con `mode="wait"` prima c'è ancora quello vecchio).
  // Al primo montaggio lo gestisce chi apre il form (es. il dialog).
  function focusStep(definition: unknown) {
    if (definition !== "center") return;
    if (!moved.current) return;
    ref.current?.querySelector<HTMLElement>(FOCUS_SELECTOR)?.focus({ preventScroll: true });
  }

  return (
    <AnimatePresence mode="wait" initial={false} custom={direction}>
      <motion.div
        key={stepKey}
        ref={ref}
        custom={direction}
        variants={{
          enter: (dir: StepDirection) => ({ opacity: 0, x: STEP_SHIFT_PX * dir }),
          center: { opacity: 1, x: 0 },
          exit: (dir: StepDirection) => ({ opacity: 0, x: -STEP_SHIFT_PX * dir }),
        }}
        initial="enter"
        animate="center"
        onAnimationComplete={focusStep}
        exit="exit"
        transition={{ ...SPRING_SNAPPY, opacity: { duration: STEP_FADE_SECONDS } }}
        className={className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export interface StepHeadingProps {
  title: string;
  description?: string;
  className?: string;
}

/** Titolo del passo: una domanda o un'azione in poche parole, con una riga di spiegazione solo se serve. */
export function StepHeading({ title, description, className }: StepHeadingProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <h2 className="font-heading text-xl font-medium tracking-tight text-foreground">{title}</h2>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export interface StepActionsProps {
  /** Etichetta di «Indietro»; se assente il pulsante non c'è. */
  backLabel?: string;
  onBack?: () => void;
  /** Etichetta del pulsante principale (submit del form che lo contiene). */
  primaryLabel: string;
  pending?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Riga dei comandi: «Indietro» a sinistra, azione principale a destra (a tutta larghezza sul telefono). */
export function StepActions({ backLabel, onBack, primaryLabel, pending = false, disabled = false, className }: StepActionsProps) {
  return (
    <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between", className)}>
      {backLabel && onBack ? (
        <Button type="button" variant="ghost" onClick={onBack} disabled={pending} className="h-11 cursor-pointer sm:h-9">
          {backLabel}
        </Button>
      ) : (
        <span />
      )}
      <Button type="submit" disabled={pending || disabled} className="h-11 cursor-pointer sm:h-9 sm:min-w-32">
        {primaryLabel}
      </Button>
    </div>
  );
}
