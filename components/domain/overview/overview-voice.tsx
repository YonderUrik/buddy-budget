/** Testata della Panoramica: saluto (che entra parola per parola) e due-tre frasi che dicono com'è il mese e cosa aspetta l'utente. */

import { BlurText } from "@/components/motion";
import { buildVoiceLines, greetingFor, type VoiceInput } from "@/lib/overview/voice";

export interface OverviewVoiceProps extends VoiceInput {
  /** Nome di battesimo per il saluto (assente: solo il saluto). */
  firstName?: string;
  /** Data già formattata ("Martedì 6 ottobre 2026"). */
  dateLabel: string;
}

export function OverviewVoice({ firstName, dateLabel, ...input }: OverviewVoiceProps) {
  const lines = buildVoiceLines(input);
  const greeting = greetingFor(input.today.getHours());
  return (
    <header className="flex flex-col gap-3">
      <div>
        <BlurText as="h1" className="font-heading text-3xl font-medium text-foreground sm:text-4xl">
          {`${greeting}${firstName ? `, ${firstName}` : ""}`}
        </BlurText>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
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
