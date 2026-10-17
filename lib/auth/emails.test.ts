import { describe, expect, it } from "vitest";
import { magicLinkEmailContent, magicLinkLanguage } from "./emails";

const PARAMS = { url: "https://app.example.test/api/auth/verify?token=t", expiresInMinutes: 10, appUrl: "https://app.example.test" };

describe("magicLinkEmailContent", () => {
  it("riporta il link, la scadenza e ha una versione HTML", () => {
    const { subject, text, html } = magicLinkEmailContent(PARAMS);
    expect(subject).toContain("link di accesso");
    expect(text).toContain("10 minuti");
    expect(text).toContain("https://app.example.test/api/auth/verify?token=t");
    expect(html).toContain("Accedi");
  });

  it("in inglese e in tedesco, piè di pagina compreso", () => {
    const en = magicLinkEmailContent({ ...PARAMS, language: "en" });
    expect(en.subject).toBe("Your BuddyBudget sign-in link");
    expect(en.text).toContain("The link is valid for 10 minutes and works only once.");
    expect(en.text).toContain("Sign in: https://app.example.test/api/auth/verify?token=t");
    expect(en.text).toContain("it cannot be disabled");
    const de = magicLinkEmailContent({ ...PARAMS, language: "de" });
    expect(de.subject).toBe("Dein Anmeldelink für BuddyBudget");
    expect(de.text).toContain("Der Link ist 10 Minuten gültig");
    expect(de.html).toContain('<html lang="de">');
  });
});

describe("magicLinkLanguage", () => {
  const headers = (init: Record<string, string>) => new Headers(init);

  it("per un account esistente vince la lingua salvata", () => {
    expect(magicLinkLanguage({ user: { productCountry: "DE", language: "de" }, headers: headers({ cookie: "bb-language=it" }) })).toBe("de");
    expect(magicLinkLanguage({ user: { productCountry: "IT", language: "it" }, headers: headers({ "accept-language": "en" }) })).toBe("it");
  });

  it("per un indirizzo nuovo usa la lingua scelta sulla pagina, poi quella del browser", () => {
    expect(magicLinkLanguage({ user: null, headers: headers({ cookie: "theme=dark; bb-language=en", "accept-language": "de-DE" }) })).toBe("en");
    expect(magicLinkLanguage({ user: null, headers: headers({ "accept-language": "de-DE,de;q=0.9" }) })).toBe("de");
    expect(magicLinkLanguage({ user: null, headers: headers({ cookie: "bb-language=fr" }) })).toBe("it");
    expect(magicLinkLanguage({ user: undefined, headers: null })).toBe("it");
  });
});
