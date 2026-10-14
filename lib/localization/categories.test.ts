import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORIES } from "@/lib/categories/defaults";
import { localizeCategory, localizedCategoryProposal } from "./categories";
import { translate } from "./messages";
import type { LocaleProfile } from "./config";

const profiles: LocaleProfile[] = [{ productCountry: "IT", language: "it" }, { productCountry: "IT", language: "en" }, { productCountry: "DE", language: "de" }, { productCountry: "DE", language: "en" }];
describe("default category labels", () => {
  it("switches every default between all profiles without changing IDs or stored data", () => {
    for (const definition of DEFAULT_CATEGORIES) {
      const row = { ...definition, id: "same-id", defaultKey: definition.key };
      for (const profile of profiles) {
        const displayed = localizeCategory(row, profile);
        expect(displayed.name).toBe(translate(profile.language, definition.name));
        expect(displayed.id).toBe(row.id);
        expect(row.name).toBe(definition.name);
        expect(localizeCategory(displayed, profiles[0]).name).toBe(definition.name);
      }
    }
  });
  it("preserves custom names even when they match a source or translated default", () => {
    for (const name of ["Spesa", "Groceries", "My groceries"]) {
      expect(localizeCategory({ name, defaultKey: null }, profiles[2]).name).toBe(name);
    }
    expect(localizeCategory({ name: "My groceries", defaultKey: "spesa", description: "My own notes" }, profiles[2])).toMatchObject({ name: "My groceries", description: "My own notes" });
  });
  it("translates persisted English defaults back into German and Italian", () => {
    const row = { name: translate("en", "Trasferimenti tra i miei conti"), defaultKey: "trasferimenti" };
    expect(localizeCategory(row, profiles[2]).name).toBe(translate("de", "Trasferimenti tra i miei conti"));
    expect(localizeCategory(row, profiles[0]).name).toBe("Trasferimenti tra i miei conti");
  });
  it("uses country-specific descriptions while retaining edited descriptions", () => {
    const original = localizedCategoryProposal(profiles[2]).find(c => c.key === "tasse")!;
    const row = { ...original, defaultKey: original.key };
    expect(localizeCategory(row, profiles[1]).description).toBe(localizedCategoryProposal(profiles[1]).find(c => c.key === "tasse")!.description);
    expect(localizeCategory({ ...row, description: "My tax notes" }, profiles[1]).description).toBe("My tax notes");
  });
});
