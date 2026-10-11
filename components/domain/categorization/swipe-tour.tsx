"use client";

/**
 * Tour guidato delle carte: cinque passi animati (la carta, destra, sinistra, alto, annulla e ricorda) che compaiono
 * da soli la prima volta e si riaprono da «Come funziona». Il fatto di averlo visto si ricorda solo su questo
 * dispositivo (localStorage): se non è disponibile, il tour ricompare e basta. Con il movimento ridotto le animazioni
 * si fermano sulla posizione finale.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, CircleHelpIcon, Undo2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { SPRING_SOFT } from "@/lib/motion/springs";
import { cn } from "@/lib/utils";

/** Chiave in cui si ricorda che il tour è già stato visto. */
export const SWIPE_TOUR_STORAGE_KEY = "bb:categorize-tour-seen";
/** Distanza (px) di cui la carta d'esempio si sposta nelle animazioni. */
const DEMO_TRAVEL_PX = 44;
/** Durata di un giro delle animazioni d'esempio. */
const DEMO_LOOP_SECONDS = 2.2;

type Gesture = "carta" | "destra" | "sinistra" | "alto" | "annulla";

interface TourStep {
  gesture: Gesture;
  title: string;
  text: string;
  keys?: string;
}

const STEPS: readonly TourStep[] = [
  { gesture: "carta", title: "Una carta per esercente", text: "In alto c'è l'esercente con il totale, sotto la categoria che l'assistente propone. Nulla si applica da solo." },
  { gesture: "destra", title: "A destra: è questa", text: "Trascina la carta a destra per confermare la categoria proposta.", keys: "→ o Invio" },
  { gesture: "sinistra", title: "A sinistra: un'altra", text: "Trascinala a sinistra per scegliere tu la categoria giusta.", keys: "←" },
  { gesture: "alto", title: "In alto: salta", text: "Non sei sicuro? Trascinala in alto: torna in fondo al mazzo.", keys: "↓" },
  { gesture: "annulla", title: "Annulla e ricorda", text: "Hai sbagliato? Annulla finché la scelta non è salvata (qualche secondo). Spunta «Ricorda» solo se vuoi una regola per quell'esercente.", keys: "Z" },
];

function readSeen(): boolean {
  try {
    return window.localStorage.getItem(SWIPE_TOUR_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSeen() {
  try {
    window.localStorage.setItem(SWIPE_TOUR_STORAGE_KEY, "1");
  } catch {
    // Senza localStorage il tour ricompare: nessun danno.
  }
}

/** Carta d'esempio che mostra il gesto del passo corrente. */
function DemoCard({ gesture, reduced }: { gesture: Gesture; reduced: boolean }) {
  const loop = reduced ? { duration: 0 } : { duration: DEMO_LOOP_SECONDS, repeat: Infinity, repeatDelay: 0.5, ease: "easeInOut" as const };
  const keyframes = {
    carta: { x: [0, 0], y: [0, 0], rotate: [0, 0] },
    destra: { x: [0, DEMO_TRAVEL_PX, DEMO_TRAVEL_PX, 0], y: 0, rotate: [0, 7, 7, 0] },
    sinistra: { x: [0, -DEMO_TRAVEL_PX, -DEMO_TRAVEL_PX, 0], y: 0, rotate: [0, -7, -7, 0] },
    alto: { x: 0, y: [0, -DEMO_TRAVEL_PX * 0.7, -DEMO_TRAVEL_PX * 0.7, 0], rotate: 0 },
    annulla: { x: [0, DEMO_TRAVEL_PX, 0, 0], y: 0, rotate: [0, 7, 0, 0] },
  }[gesture];
  const stamp = { destra: "È questa", sinistra: "Un'altra", alto: "Salta", annulla: "Annullato", carta: "" }[gesture];
  const stampTone = { destra: "border-pos text-pos", sinistra: "border-neg text-neg", alto: "border-muted-foreground text-muted-foreground", annulla: "border-primary text-primary", carta: "" }[gesture];

  return (
    <div className="relative flex h-52 items-center justify-center overflow-hidden rounded-xl bg-muted/50">
      <motion.div animate={keyframes} transition={loop} className="relative flex w-44 flex-col items-center gap-2 rounded-xl border border-border bg-card p-4 shadow-md">
        {stamp && (
          <motion.span
            animate={{ opacity: reduced ? 1 : [0, 1, 1, 0] }}
            transition={loop}
            className={cn("absolute -top-3 rounded-md border-2 bg-card px-1.5 py-0.5 text-[0.65rem] font-semibold", stampTone)}
          >
            {stamp}
          </motion.span>
        )}
        <span className="mt-1 text-sm font-medium text-foreground">Supermercato</span>
        <span className="text-xs text-muted-foreground tabular-nums">-48,20 €</span>
        <span className="mt-1 w-full rounded-lg bg-muted px-2 py-1.5 text-center text-xs text-foreground">Spesa</span>
        <span className="flex items-center gap-1.5 text-[0.65rem] text-muted-foreground">
          <span className={cn("size-3 rounded-sm border border-input", gesture === "annulla" && "border-primary bg-primary/20")} /> Ricorda
        </span>
      </motion.div>
      <span className="absolute bottom-3 text-muted-foreground">
        {gesture === "destra" && <ArrowRightIcon className="size-5 text-pos" />}
        {gesture === "sinistra" && <ArrowLeftIcon className="size-5 text-neg" />}
        {gesture === "alto" && <ArrowDownIcon className="size-5 rotate-180" />}
        {gesture === "annulla" && <Undo2Icon className="size-5 text-primary" />}
      </span>
    </div>
  );
}

export function SwipeTour() {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const reduced = useReducedMotion() ?? false;
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  // Si apre da solo solo alla prima volta: il valore arriva dal browser, quindi dopo il montaggio.
  React.useEffect(() => {
    const timer = setTimeout(() => setOpen(!readSeen()), 400);
    return () => clearTimeout(timer);
  }, []);

  function close(action: "salta" | "fine") {
    track("categorize_tour", { action, step: index + 1 });
    writeSeen();
    setOpen(false);
    setIndex(0);
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="mx-auto"
        onClick={() => {
          track("categorize_tour", { action: "riapri", step: 1 });
          setIndex(0);
          setOpen(true);
        }}
      >
        <CircleHelpIcon /> Come funziona
      </Button>
      <AnimatePresence>
        {open && (
          <motion.div
            key="tour"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-4 backdrop-blur-sm sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Come funzionano le carte"
          >
            <motion.div
              initial={{ y: 40, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={SPRING_SOFT}
              className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-xl"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={step.gesture}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.18 }}
                  className="flex flex-col gap-3"
                >
                  <DemoCard gesture={step.gesture} reduced={reduced} />
                  <div className="flex flex-col gap-1">
                    <p className="font-heading text-lg font-medium text-foreground">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.text}</p>
                    {step.keys && <p className="hidden text-xs text-muted-foreground sm:block">Da tastiera: {step.keys}</p>}
                  </div>
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5" aria-label={`Passo ${index + 1} di ${STEPS.length}`}>
                  {STEPS.map((candidate, i) => (
                    <span key={candidate.gesture} className={cn("h-1.5 rounded-full transition-all", i === index ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")} />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  {!isLast && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => close("salta")}>
                      Salta
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      if (isLast) return close("fine");
                      track("categorize_tour", { action: "avanti", step: index + 1 });
                      setIndex(index + 1);
                    }}
                  >
                    {isLast ? "Inizia" : "Avanti"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
