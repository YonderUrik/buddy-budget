import { describe, expect, it } from "vitest";
import type { Account } from "@/lib/db/schema/accounts";
import { groupAccounts, MANUAL_GROUP_KEY, UNKNOWN_BANK_LABEL } from "./accounts-grouping";

function account(id: string, source: "auto" | "manuale"): Account {
  return { id, source } as Account;
}

describe("groupAccounts", () => {
  it("raggruppa per banca in ordine alfabetico e mette i manuali in fondo", () => {
    const groups = groupAccounts(
      [account("1", "auto"), account("2", "manuale"), account("3", "auto"), account("4", "auto")],
      new Map([["1", "Fineco"], ["3", "Banca Sella"], ["4", "Fineco"]])
    );
    expect(groups.map((g) => g.label)).toEqual(["Banca Sella", "Fineco", "Manuali"]);
    expect(groups[1].accounts.map((a) => a.id)).toEqual(["1", "4"]);
    expect(groups[2].key).toBe(MANUAL_GROUP_KEY);
  });

  it("usa un nome generico se la banca non è nota e omette i manuali se non ce ne sono", () => {
    const groups = groupAccounts([account("1", "auto")], new Map());
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe(UNKNOWN_BANK_LABEL);
  });

  it("senza conti non produce gruppi", () => {
    expect(groupAccounts([], new Map())).toEqual([]);
  });
});
