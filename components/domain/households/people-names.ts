import type { HouseholdPerson } from "@/lib/households/types";

type Translate = (text: string, values?: Record<string, string | number>) => string;

/** «Marco», «tu e Luca», «Tu, Marco e Sara»: names joined the way a sentence lists them. */
export function joinNames(names: readonly string[], tr: Translate): string {
  if (names.length <= 1) return names[0] ?? "";
  return tr("{0} e {1}", { 0: names.slice(0, -1).join(", "), 1: names.at(-1)! });
}

/** «Tu e Giulia», «Tu, Marco e Sara»: the members' names with the viewer first, in the screen's language. */
export function peopleNames(members: readonly HouseholdPerson[], tr: Translate): string {
  return joinNames(members.map((m) => (m.isMe ? tr("Tu") : m.name)), tr);
}
