import { describe, expect, it } from "vitest";
import { updateUserSettingsSchema } from "./user-settings";

describe("updateUserSettingsSchema", () => {
  it("accetta aggiornamenti parziali validi e toglie gli spazi dal nome", () => {
    expect(updateUserSettingsSchema.parse({ name: "  Anna  " })).toEqual({ name: "Anna" });
    expect(updateUserSettingsSchema.parse({ currency: "CHF", homePage: "/conti" })).toEqual({ currency: "CHF", homePage: "/conti" });
  });

  it.each([
    [{}],
    [{ name: "   " }],
    [{ name: "x".repeat(81) }],
    [{ currency: "BTC" }],
    [{ homePage: "/login" }],
    [{ onboardingCompleted: true }],
    [{ deletionScheduledAt: null }],
  ])("rifiuta %j", (input) => {
    expect(updateUserSettingsSchema.safeParse(input).success).toBe(false);
  });
});
