"use client";

/**
 * UpcomingFeatures
 *
 * Riga "In arrivo" del pannello del login: mostra una funzionalità futura alla volta con dissolvenza lenta,
 * più una fila di icone che indica quale si sta leggendo. Con `prefers-reduced-motion` resta ferma sulla prima
 * e le icone diventano un elenco statico. L'elenco completo è sempre disponibile agli screen reader.
 */

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";
import { UPCOMING_FEATURE_INTERVAL_MS, UPCOMING_FEATURES } from "./upcoming-features.data";
import { STORY_EASE } from "./story-motion";

export interface UpcomingFeaturesProps {
  className?: string;
}

export function UpcomingFeatures({ className }: UpcomingFeaturesProps) {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (reduceMotion || UPCOMING_FEATURES.length < 2) return;
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % UPCOMING_FEATURES.length),
      UPCOMING_FEATURE_INTERVAL_MS
    );
    return () => window.clearInterval(id);
  }, [reduceMotion]);

  const current = UPCOMING_FEATURES[index];
  if (!current) return null;

  return (
    <section className={cn("flex flex-col gap-3 border-t border-sidebar-foreground/15 pt-5", className)}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xs font-medium text-sidebar-foreground/60">In arrivo</h3>
        <ul className="flex items-center gap-1" aria-hidden="true">
          {UPCOMING_FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <li
                key={feature.name}
                className={cn(
                  "flex size-6 items-center justify-center rounded-md transition-colors duration-500",
                  i === index ? "bg-sidebar-foreground/15 text-sidebar-foreground" : "text-sidebar-foreground/40"
                )}
              >
                <Icon className="size-3.5" />
              </li>
            );
          })}
        </ul>
      </div>

      <ul className="sr-only">
        {UPCOMING_FEATURES.map((feature) => (
          <li key={feature.name}>
            {feature.name}: {feature.description}
          </li>
        ))}
      </ul>

      {reduceMotion ? (
        <p className="text-sm text-sidebar-foreground/75" aria-hidden="true">
          {UPCOMING_FEATURES.map((f) => f.name).join(" · ")}
        </p>
      ) : (
        // Altezza fissa per due righe di descrizione: il cambio non sposta il layout.
        <div className="relative h-12" aria-hidden="true">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={current.name}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.5, ease: STORY_EASE }}
              className="absolute inset-0 text-sm leading-snug text-sidebar-foreground/75"
            >
              <span className="font-medium text-sidebar-foreground">{current.name}.</span> {current.description}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </section>
  );
}
