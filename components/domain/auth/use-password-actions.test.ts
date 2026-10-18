import { describe, expect, it } from "vitest";
import { describePasswordError } from "./use-password-actions";

describe("describePasswordError", () => {
  it("maps better-auth codes to readable messages", () => {
    expect(describePasswordError({ status: 401, code: "INVALID_EMAIL_OR_PASSWORD" })).toBe("Email o password non corretti.");
    expect(describePasswordError({ status: 422, code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })).toContain("Esiste già un account");
    expect(describePasswordError({ status: 400, code: "PASSWORD_TOO_SHORT" })).toContain("almeno 10 caratteri");
    expect(describePasswordError({ status: 403, code: "SIGNUPS_CLOSED" })).toContain("non si possono creare nuovi account");
  });

  it("says when to wait, and never stays silent", () => {
    expect(describePasswordError({ status: 429 })).toContain("Troppi tentativi");
    expect(describePasswordError(null)).toBe("Qualcosa non ha funzionato. Riprova.");
    expect(describePasswordError({ status: 500 })).toBe("Qualcosa non ha funzionato. Riprova.");
  });
});
