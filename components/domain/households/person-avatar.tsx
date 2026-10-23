/** Round initial of a group member, in the colour of their slot (the viewer is always the first colour). */

import { cn } from "@/lib/utils";

/** Background and text of each slot, from the `--person-*` tokens. */
const SLOT_CLASSES = [
  "bg-person-1/15 text-person-1",
  "bg-person-2/15 text-person-2",
  "bg-person-3/15 text-person-3",
  "bg-person-4/15 text-person-4",
  "bg-person-5/15 text-person-5",
  "bg-person-6/15 text-person-6",
] as const;

/** Solid colour of each slot, for a member's share of a bar. */
export const PERSON_FILL_CLASSES = ["bg-person-1", "bg-person-2", "bg-person-3", "bg-person-4", "bg-person-5", "bg-person-6"] as const;

export interface PersonAvatarProps {
  initial: string;
  slot: number;
  /** Accessible name (the member's first name). */
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const SIZES = { xs: "size-5 text-[10px]", sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-12 text-lg" } as const;

export function PersonAvatar({ initial, slot, name, size = "sm", className }: PersonAvatarProps) {
  return (
    <span role="img" aria-label={name} className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold", SIZES[size], SLOT_CLASSES[slot % SLOT_CLASSES.length], className)}>
      {initial}
    </span>
  );
}

/** Overlapping avatars of a group's members, with a ring of the page background between them. */
export function PersonStack({ people, size = "sm", className }: { people: readonly { userId: string; initial: string; slot: number; name: string }[]; size?: PersonAvatarProps["size"]; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", className)}>
      {people.map((p, i) => (
        <PersonAvatar key={p.userId} initial={p.initial} slot={p.slot} name={p.name} size={size} className={cn(i > 0 && "-ml-2 ring-2 ring-background")} />
      ))}
    </span>
  );
}
