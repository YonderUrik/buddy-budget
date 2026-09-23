import { describe, expect, it } from "vitest";
import { planCategoryReset, type ExistingCategory, type ResetDefault } from "./reset-categories";

const DEFAULTS: ResetDefault[] = [
  { name: "Affitto & Mutuo", type: "dovuta", icon: "home", color: "slate" },
  { name: "Salute & Farmaci", type: "dovuta", icon: "pill", color: "rose" },
  { name: "Abbonamenti", type: "voluta", icon: "tv", color: "purple" },
  { name: "Da categorizzare", type: "voluta", icon: "help-circle", color: "red", isFallback: true },
];
const LEGACY = { "Salute & Cura": "Salute & Farmaci" };

function existing(id: string, name: string, type = "dovuta", isFallback = false): ExistingCategory {
  return { id, name, type, icon: "package", color: "slate", isFallback };
}

describe("planCategoryReset", () => {
  it("aggiorna per nome esatto preservando l'id", () => {
    const plan = planCategoryReset([existing("a", "Abbonamenti", "dovuta")], DEFAULTS, LEGACY);
    expect(plan.updates).toContainEqual({ id: "a", name: "Abbonamenti", type: "voluta", icon: "tv", color: "purple" });
  });

  it("aggiorna una categoria col nome legacy rinominandola", () => {
    const plan = planCategoryReset([existing("s", "Salute & Cura", "voluta")], DEFAULTS, LEGACY);
    expect(plan.updates).toContainEqual({ id: "s", name: "Salute & Farmaci", type: "dovuta", icon: "pill", color: "rose" });
    expect(plan.deletions).toEqual([]);
  });

  it("se esistono sia il nome esatto sia il legacy, vince l'esatto e la legacy va eliminata", () => {
    const plan = planCategoryReset(
      [existing("legacy", "Salute & Cura"), existing("exact", "Salute & Farmaci")],
      DEFAULTS,
      LEGACY
    );
    expect(plan.updates.map((u) => u.id)).toContain("exact");
    expect(plan.updates.map((u) => u.id)).not.toContain("legacy");
    expect(plan.deletions).toEqual(["legacy"]);
  });

  it("crea le categorie di default mancanti (mai la fallback)", () => {
    const plan = planCategoryReset([], DEFAULTS, LEGACY);
    expect(plan.creates.map((c) => c.name)).toEqual(["Affitto & Mutuo", "Salute & Farmaci", "Abbonamenti"]);
  });

  it("elimina le categorie personalizzate e non tocca mai la fallback", () => {
    const plan = planCategoryReset(
      [existing("custom", "Palestra"), existing("fb", "Da categorizzare", "voluta", true)],
      DEFAULTS,
      LEGACY
    );
    expect(plan.deletions).toEqual(["custom"]);
    expect(plan.updates.map((u) => u.id)).not.toContain("fb");
  });

  it("su uno stato già resettato non produce azioni", () => {
    const already: ExistingCategory[] = DEFAULTS.map((d, index) => ({
      id: `id-${index}`,
      name: d.name,
      type: d.type,
      icon: d.icon,
      color: d.color,
      isFallback: d.isFallback ?? false,
    }));
    const plan = planCategoryReset(already, DEFAULTS, LEGACY);
    expect(plan).toEqual({ updates: [], creates: [], deletions: [] });
  });

  it("una categoria col nome legacy e una categoria personalizzata distinta: solo la legacy viene aggiornata, solo la personalizzata eliminata", () => {
    const plan = planCategoryReset(
      [existing("s", "Salute & Cura", "voluta"), existing("custom", "Palestra")],
      DEFAULTS,
      LEGACY
    );
    expect(plan.updates).toContainEqual({ id: "s", name: "Salute & Farmaci", type: "dovuta", icon: "pill", color: "rose" });
    expect(plan.deletions).toEqual(["custom"]);
  });
});
