/**
 * Riga "Nuovo" del pannello del login: annuncia l'ultima funzionalità disponibile (di default `LATEST_FEATURE`).
 * Su schermi bassi (sotto 940px, come il sottotitolo del pannello) si mostra la frase corta, per non allungare il pannello.
 */

import { cn } from "@/lib/utils";
import { LATEST_FEATURE, type NewFeature } from "./new-feature.data";

export interface NewFeatureNoteProps {
  feature?: NewFeature;
  label?: string;
  className?: string;
}

export function NewFeatureNote({ feature = LATEST_FEATURE, label = "Nuovo", className }: NewFeatureNoteProps) {
  const Icon = feature.icon;
  return (
    <section className={cn("flex items-start gap-3", className)}>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-foreground/15 text-sidebar-foreground [@media(max-height:940px)]:hidden"
        aria-hidden="true"
      >
        <Icon className="size-4" />
      </span>
      <p className="text-sm leading-snug text-sidebar-foreground/75">
        <span className="mr-1.5 rounded-sm bg-sidebar-foreground/15 px-1.5 py-0.5 text-xs font-medium text-sidebar-foreground">
          {label}
        </span>
        <span className="font-medium text-sidebar-foreground">{feature.name}.</span>{" "}
        <span className="[@media(max-height:940px)]:hidden">{feature.description}</span>
        <span className="hidden [@media(max-height:940px)]:inline">{feature.summary}</span>
      </p>
    </section>
  );
}
