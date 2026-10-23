"use client";

/**
 * The people of a group as tappable chips: one to pick (who paid) or several (who it was for, with «Tutti» first).
 * The viewer reads «Tu». Used by «Aggiungi una spesa» and by «In comune con» on a transaction.
 */

import { CheckIcon } from "lucide-react";
import type { HouseholdPerson } from "@/lib/households/types";
import { useLocalization } from "@/lib/localization/provider";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./person-avatar";

const CHIP = "inline-flex h-11 items-center gap-2 rounded-full pr-4 pl-1.5 text-sm font-medium transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none";
const ON = "bg-foreground text-background";
const OFF = "bg-muted text-foreground hover:bg-muted/70";

export interface PersonChipsProps {
  people: readonly HouseholdPerson[];
  ariaLabel: string;
  className?: string;
}

/** One person among the group's (who paid). */
export function PersonPicker({ people, value, onChange, ariaLabel, className }: PersonChipsProps & { value: string; onChange: (id: string) => void }) {
  const { t: tr } = useLocalization();
  return (
    <div role="radiogroup" aria-label={tr(ariaLabel)} className={cn("flex flex-wrap gap-2", className)}>
      {people.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={value === p.id} onClick={() => onChange(p.id)} className={cn(CHIP, value === p.id ? ON : OFF)}>
          <PersonAvatar initial={p.initial} slot={p.slot} name={p.name} size="sm" className={value === p.id ? "bg-background" : undefined} />
          {p.isMe ? tr("Tu") : p.name}
        </button>
      ))}
    </div>
  );
}

/**
 * Who an expense is for: «Tutti» (value null) or some people, also only someone else. Turning off the last person
 * is not possible: an expense is always for someone; choosing everyone one by one goes back to «Tutti».
 */
export function PeopleFor({ people, value, onChange, ariaLabel, className }: PersonChipsProps & { value: readonly string[] | null; onChange: (ids: string[] | null) => void }) {
  const { t: tr } = useLocalization();
  const chosen = value ?? people.map((p) => p.id);
  const everyone = value === null || chosen.length === people.length;

  /** From «Tutti», a tap picks only that person (the quickest way to say «l'ho pagata per Marco»). */
  function toggle(id: string) {
    const next = everyone ? [id] : chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id];
    if (next.length === 0) return;
    onChange(next.length === people.length ? null : people.filter((p) => next.includes(p.id)).map((p) => p.id));
  }

  return (
    <div role="group" aria-label={tr(ariaLabel)} className={cn("flex flex-wrap gap-2", className)}>
      <button type="button" aria-pressed={everyone} onClick={() => onChange(null)} className={cn(CHIP, "pl-4", everyone ? ON : OFF)}>
        {tr("Tutti")}
      </button>
      {people.map((p) => {
        const on = !everyone && chosen.includes(p.id);
        return (
          <button key={p.id} type="button" aria-pressed={on} onClick={() => toggle(p.id)} className={cn(CHIP, on ? ON : OFF)}>
            <PersonAvatar initial={p.initial} slot={p.slot} name={p.name} size="sm" className={on ? "bg-background" : undefined} />
            {p.isMe ? tr("Tu") : p.name}
            {on ? <CheckIcon className="size-3.5" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
