import { describe, expect, it } from "vitest";
import { AI_DATA, ANALYTICS_DATA, CONTROLS, FIELD_ENCRYPTION_LIVE, FLOW, GOCARDLESS_DATA, LIMITS, STORED } from "./security";
import { TRUST, UNDER_HOOD } from "./home";
import { FAQ } from "./site";
import { FAQ_EN, HOME_EN } from "./en/home";
import { SECURITY_EN } from "./en/security";

/** Every public text about security: the home («Legge soltanto», «Sotto il cofano», FAQ) and the /sicurezza page. */
const allText = () => JSON.stringify([FLOW, STORED, GOCARDLESS_DATA, AI_DATA, ANALYTICS_DATA, CONTROLS, LIMITS, TRUST, UNDER_HOOD, FAQ]);

describe("security texts", () => {
  it("mention database encryption only when it is live in production", () => {
    const claims = /cifrat[ei][^.]*(nel database|nei backup)|cifra prima di salvarle/i.test(allText());
    expect(claims).toBe(FIELD_ENCRYPTION_LIVE);
  });

  it("say the same in English", () => {
    const en = JSON.stringify([SECURITY_EN, HOME_EN.trust, HOME_EN.hood, FAQ_EN]);
    const claims = /encrypt[^.]*(in the database|in the backups|before they are stored|there too)/i.test(en);
    expect(claims).toBe(FIELD_ENCRYPTION_LIVE);
  });
});
