"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Testata della Panoramica: saluto (che entra parola per parola) e due-tre frasi che dicono com'è il mese e cosa aspetta l'utente. */

import type { ReactNode } from "react";
import { BlurText } from "@/components/motion";
import { buildVoiceLines, greetingFor, type VoiceInput } from "@/lib/overview/voice";

export interface OverviewVoiceProps extends VoiceInput {
  /** Nome di battesimo per il saluto (assente: solo il saluto). */
  firstName?: string;
  /** Data già formattata ("Martedì 6 ottobre 2026"). */
  dateLabel: string;
  /** Contenuto accanto alla data (es. la novità del momento). */
  dateAside?: ReactNode;
}

export function OverviewVoice({ firstName, dateLabel, dateAside, ...input }: OverviewVoiceProps) {
  const { language, t } = useLocalization();
  const lines = buildVoiceLines({ ...input, language });
  const greeting = t(greetingFor(input.today.getHours()));
  return (
    <header className="flex flex-col gap-3">
      <div>
        <BlurText as="h1" className="font-heading text-3xl font-medium text-foreground sm:text-4xl">
          {`${greeting}${firstName ? `, ${firstName}` : ""}`}
        </BlurText>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
          {dateAside}
        </div>
      </div>
      <p className="max-w-[60ch] text-lg leading-relaxed text-text-2 sm:text-xl">
        {lines.map((line) => (
          <span key={line.key}>
            {line.segments.map((segment, index) =>
              segment.strong ? (
                <strong key={index} className="whitespace-nowrap font-heading font-medium text-foreground">
                  {segment.text}
                </strong>
              ) : (
                <span key={index}>{segment.text}</span>
              )
            )}{" "}
          </span>
        ))}
      </p>
    </header>
  );
}
