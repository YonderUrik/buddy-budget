import { describe, expect, it } from "vitest";
import { pickWhatsNew } from "./pick";
import type { WhatsNewEntry } from "./entries";

const entry = (id: string, date: string): WhatsNewEntry => ({ id, date, title: id, summary: "", href: "/", ctaLabel: "Vai" });
const now = new Date("2026-10-20T10:00:00Z");

describe("pickWhatsNew", () => {
  it("sceglie la più recente non chiusa", () => {
    const entries = [entry("a", "2026-10-01"), entry("b", "2026-10-10")];
    expect(pickWhatsNew(entries, [], now)?.id).toBe("b");
    expect(pickWhatsNew(entries, ["b"], now)?.id).toBe("a");
  });

  it("non mostra le voci troppo vecchie né quelle già chiuse", () => {
    expect(pickWhatsNew([entry("old", "2026-01-01")], [], now)).toBeNull();
    expect(pickWhatsNew([entry("a", "2026-10-10")], ["a"], now)).toBeNull();
  });
});
