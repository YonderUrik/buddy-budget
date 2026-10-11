import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/db/schema/categories";
import {
  buildCategoryProposal,
  isCustomized,
  planCategorySetup,
  summarizeCategorySetup,
  validateCategorySetup,
  type CategorySetupItem,
} from "./setup";

const seeded = DEFAULT_CATEGORIES.map((category, index) => ({ id: `id-${index}`, name: category.name, isFallback: category.isFallback ?? false }));
const idOf = (name: string) => seeded.find((row) => row.name === name)!.id;
const proposal = (): CategorySetupItem[] => buildCategoryProposal().map(({ key, name, type, enabled }) => ({ key, name, type, enabled }));
const withItem = (items: CategorySetupItem[], key: string, patch: Partial<CategorySetupItem>) =>
  items.map((item) => (item.key === key ? { ...item, ...patch } : item));

describe("buildCategoryProposal", () => {
  it("propone le default accese senza la fallback e le facoltative spente", () => {
    const items = buildCategoryProposal();
    expect(items.filter((item) => item.enabled)).toHaveLength(24);
    expect(items.filter((item) => item.optional).every((item) => !item.enabled)).toBe(true);
    expect(items.some((item) => item.name === "Da categorizzare")).toBe(false);
  });
});

describe("planCategorySetup", () => {
  it("non cambia nulla se l'utente conferma la proposta", () => {
    expect(planCategorySetup(seeded, proposal())).toEqual({ deletions: [], renames: [], creates: [] });
    expect(isCustomized(proposal())).toBe(false);
  });

  it("elimina le default spente, rinomina, crea facoltative e aggiunte; la fallback resta", () => {
    let items = withItem(proposal(), "contanti", { enabled: false });
    items = withItem(items, "bollette", { name: "  Bollette " });
    items = withItem(items, "animali", { enabled: true });
    items.push({ key: null, name: "Musica", type: "voluta", enabled: true });
    items.push({ key: null, name: "Spenta", type: "voluta", enabled: false });

    const plan = planCategorySetup(seeded, items);
    expect(plan.deletions).toEqual([idOf("Contanti")]);
    expect(plan.renames).toEqual([{ id: idOf("Bollette & Telefono"), name: "Bollette" }]);
    expect(plan.creates.map((create) => create.name)).toEqual(["Animali", "Musica"]);
    expect(plan.creates[1]).toMatchObject({ type: "voluta", icon: "package", description: null });
    expect(plan.deletions).not.toContain(idOf("Da categorizzare"));
  });

  it("una default assente dalle scelte si elimina", () => {
    const items = proposal().filter((item) => item.key !== "viaggi");
    expect(planCategorySetup(seeded, items).deletions).toEqual([idOf("Viaggi")]);
  });
});

describe("validateCategorySetup", () => {
  it("rifiuta nomi vuoti, duplicati (anche con la fallback) o troppo lunghi", () => {
    expect(validateCategorySetup(proposal())).toBeNull();
    expect(validateCategorySetup(withItem(proposal(), "spesa", { name: " " }))).toMatch(/nome/);
    expect(validateCategorySetup(withItem(proposal(), "spesa", { name: "salute" }))).toMatch(/c'è già/);
    expect(validateCategorySetup(withItem(proposal(), "spesa", { name: "Da categorizzare" }), ["Da categorizzare"])).toMatch(/c'è già/);
    expect(validateCategorySetup(withItem(proposal(), "spesa", { name: "x".repeat(41) }))).toMatch(/lungo/);
  });

  it("ignora i nomi delle categorie spente", () => {
    expect(validateCategorySetup(withItem(proposal(), "spesa", { name: "Salute", enabled: false }))).toBeNull();
  });
});

describe("summarizeCategorySetup", () => {
  it("conta tolte, rinominate, facoltative e aggiunte", () => {
    let items = withItem(proposal(), "contanti", { enabled: false });
    items = withItem(items, "spesa", { name: "Supermercato" });
    items = withItem(items, "figli", { enabled: true });
    items.push({ key: null, name: "Musica", type: "voluta", enabled: true });
    expect(summarizeCategorySetup(items)).toEqual({ active: 25, removed: 1, renamed: 1, optionalAdded: 1, custom: 1 });
  });
});
