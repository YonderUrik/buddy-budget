"use client";
import { useLocalization } from "@/lib/localization/provider";
/** Panoramica header: the greeting (entering word by word), the date and up to two short lines on the month and the next instalment. */

import type { ReactNode } from "react";
import { BlurText } from "@/components/motion";
import { buildVoiceLines, greetingFor, type VoiceInput } from "@/lib/overview/voice";
import { PAGE_TITLE_FACE } from "@/components/domain/shared";
import { cn } from "@/lib/utils";

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
    <header className="flex flex-col gap-2">
      <div>
        <BlurText as="h1" className={cn(PAGE_TITLE_FACE, "text-[2.75rem] sm:text-[3.5rem]")}>
          {`${greeting}${firstName ? `, ${firstName}` : ""}`}
        </BlurText>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-sm text-muted-foreground">{dateLabel}</p>
          {dateAside}
        </div>
      </div>
      {lines.length > 0 ? (
        <ul className="flex flex-col gap-0.5 text-[15px] leading-snug text-text-2 sm:text-base">
          {lines.map((line) => (
            <li key={line.key}>
              {line.segments.map((segment, index) =>
                segment.strong ? (
                  <strong
                    key={index}
                    className={cn("whitespace-nowrap font-heading font-medium", segment.tone === "neg" ? "text-neg" : segment.tone === "pos" ? "text-pos" : "text-foreground")}
                  >
                    {segment.text}
                  </strong>
                ) : (
                  <span key={index}>{segment.text}</span>
                )
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  );
}
