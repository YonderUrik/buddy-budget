import { describe, expect, it } from "vitest";
import {
  buildCategoryPickerSections,
  normalizeForSearch,
  pickDefaultCategoryId,
  MOST_USED_MIN_TOTAL,
  type PickerCategory,
} from "./picker";

function cat(id: string, name: string, type: string, isFallback = false): PickerCategory {
  return { id, name, type, isFallback };
}

const CATEGORIES: PickerCategory[] = [
  cat("affitto", "Affitto & Mutuo", "dovuta"),
  cat("spesa", "Spesa alimentare", "dovuta"),
  cat("bollette", "Bollette & Utenze", "dovuta"),
  cat("ristoranti", "Ristoranti & Bar", "voluta"),
  cat("caffe", "Caffè", "voluta"),
  cat("abbonamenti", "Abbonamenti & Streaming", "voluta"),
  cat("investimenti", "Investimenti", "futuro"),
  cat("regali", "Regali", "saltuaria"),
  cat("stipendio", "Stipendio", "entrata"),
  cat("fallback", "Da categorizzare", "voluta", true),
];

describe("normalizeForSearch", () => {
  it("rimuove accenti, maiuscole e spazi ai bordi", () => {
    expect(normalizeForSearch("  Caffè ")).toBe("caffe");
  });
});

describe("buildCategoryPickerSections senza ricerca", () => {
  it("mette in cima le più usate, poi i gruppi nell'ordine canonico e la fallback in coda", () => {
    const sections = buildCategoryPickerSections(CATEGORIES, { ristoranti: 10, spesa: 30, caffe: 2 }, "");
    expect(sections.map((s) => s.key)).toEqual([
      "most-used",
      "type-dovuta",
      "type-voluta",
      "type-futuro",
      "type-saltuaria",
      "type-entrata",
      "fallback",
    ]);
    expect(sections[0].categories.map((c) => c.id)).toEqual(["spesa", "ristoranti", "caffe"]);
    expect(sections[1].categories.map((c) => c.id)).toEqual(["affitto", "bollette", "spesa"]);
    expect(sections.at(-1)!.label).toBeNull();
  });

  it("limita le più usate e non include mai la fallback", () => {
    const usage = { fallback: 100, affitto: 5, spesa: 4, bollette: 3, ristoranti: 2, caffe: 1, regali: 1 };
    const sections = buildCategoryPickerSections(CATEGORIES, usage, "", 3);
    expect(sections[0].categories.map((c) => c.id)).toEqual(["affitto", "spesa", "bollette"]);
  });

  it("omette le più usate senza utilizzi o con poche categorie", () => {
    expect(buildCategoryPickerSections(CATEGORIES, {}, "")[0].key).toBe("type-dovuta");
    const few = CATEGORIES.slice(0, MOST_USED_MIN_TOTAL - 1);
    expect(buildCategoryPickerSections(few, { affitto: 3 }, "")[0].key).toBe("type-dovuta");
  });

  it("non perde categorie con tipo sconosciuto", () => {
    const sections = buildCategoryPickerSections([cat("x", "Legacy", "fissa")], {}, "");
    expect(sections).toEqual([{ key: "type-other", label: "Altre", categories: [cat("x", "Legacy", "fissa")] }]);
  });
});

describe("buildCategoryPickerSections con ricerca", () => {
  function ids(query: string, usage = {}) {
    return buildCategoryPickerSections(CATEGORIES, usage, query).flatMap((s) => s.categories.map((c) => c.id));
  }

  it("ignora accenti e maiuscole", () => {
    expect(ids("CAFFE")).toEqual(["caffe"]);
  });

  it("mette prima chi inizia con la ricerca, poi chi ha una parola che inizia, poi chi la contiene", () => {
    // "bo": Bollette inizia con "bo"; nessun'altra parola inizia con "bo"; "Abbonamenti" la contiene.
    expect(ids("bo")).toEqual(["bollette", "abbonamenti"]);
  });

  it("richiede che ogni parola compaia nel nome", () => {
    expect(ids("spesa ali")).toEqual(["spesa"]);
    expect(ids("spesa bar")).toEqual([]);
  });

  it("a parità di pertinenza preferisce la più usata", () => {
    expect(ids("i", { investimenti: 1 })[0]).toBe("investimenti");
  });

  it("trova le categorie di un gruppo cercandone il nome, dopo i match sul nome", () => {
    expect(ids("volute")).toEqual(["abbonamenti", "caffe", "ristoranti"]);
  });

  it("restituisce nessuna sezione se niente corrisponde", () => {
    expect(buildCategoryPickerSections(CATEGORIES, {}, "zzz")).toEqual([]);
  });
});

describe("pickDefaultCategoryId", () => {
  it("sceglie la più usata esclusa la fallback", () => {
    expect(pickDefaultCategoryId(CATEGORIES, { fallback: 50, caffe: 3 })).toBe("caffe");
  });

  it("senza utilizzi sceglie la prima in ordine alfabetico", () => {
    expect(pickDefaultCategoryId(CATEGORIES, {})).toBe("abbonamenti");
  });

  it("usa la fallback solo se è l'unica", () => {
    expect(pickDefaultCategoryId([cat("f", "Da categorizzare", "voluta", true)], {})).toBe("f");
    expect(pickDefaultCategoryId([], {})).toBe("");
  });
});
