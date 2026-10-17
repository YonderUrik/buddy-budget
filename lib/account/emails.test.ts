import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { accountEmailContent } from "./emails";

describe("accountEmailContent", () => {
  it("la disattivazione indica data di eliminazione e come riattivare", () => {
    const { subject, text } = accountEmailContent("deactivated", {
      deletionAt: new Date("2026-10-29T10:00:00Z"),
      appUrl: "https://www.buddybudget.io",
    });
    expect(subject).toContain("disattivato");
    expect(text).toContain("29 ottobre 2026");
    expect(text).toContain("https://www.buddybudget.io/login");
    expect(text).toContain("Riattiva account");
  });

  it("l'eliminazione conferma la cancellazione e la revoca delle banche", () => {
    const { subject, text } = accountEmailContent("deleted", { appUrl: "https://x" });
    expect(subject).toContain("eliminato");
    expect(text).toContain("revocati");
  });
});

describe("email di inattività", () => {
  it("l'avviso indica la data di eliminazione, da quanto non si accede e come tenere l'account", () => {
    const { subject, text } = accountEmailContent("inactivity_warning", {
      deletionAt: new Date("2026-11-05T10:00:00Z"),
      lastActiveAt: new Date("2026-08-07T10:00:00Z"),
      appUrl: "https://app.example.test",
    });
    expect(subject).toContain("sta per essere eliminato");
    expect(text).toContain("5 novembre 2026");
    expect(text).toContain("7 agosto 2026");
    expect(text).toContain("https://app.example.test/login");
    expect(text).toContain("90 giorni");
    expect(text).toContain("non devi fare nulla");
    expect(text).toContain("collegamenti con le banche");
  });

  it("la conferma di eliminazione parla delle copie di sicurezza e dei collegamenti bancari", () => {
    const { text } = accountEmailContent("inactivity_deleted", { appUrl: "https://x" });
    expect(text).toContain("revocati");
    expect(text).toContain("14 giorni");
  });
});

describe("email dell'account in inglese e in tedesco", () => {
  it("la disattivazione con la data nel formato della lingua", () => {
    const en = accountEmailContent("deactivated", { deletionAt: new Date("2026-10-29T10:00:00Z"), appUrl: "https://x", language: "en" });
    expect(en.subject).toBe("Your BuddyBudget account has been deactivated");
    expect(en.text).toContain("permanently deleted on 29 October 2026");
    expect(en.text).toContain("Reactivate account: https://x/login");
    const de = accountEmailContent("deactivated", { deletionAt: new Date("2026-10-29T10:00:00Z"), appUrl: "https://x", language: "de" });
    expect(de.subject).toBe("Dein BuddyBudget-Konto wurde deaktiviert");
    expect(de.text).toContain("am 29. Oktober 2026 endgültig gelöscht");
  });

  it("l'avviso di inattività e l'eliminazione", () => {
    const params = { deletionAt: new Date("2026-11-05T10:00:00Z"), lastActiveAt: new Date("2026-08-07T10:00:00Z"), appUrl: "https://x" };
    expect(accountEmailContent("inactivity_warning", { ...params, language: "en" }).text).toContain(
      "You haven't signed in to BuddyBudget since 7 August 2026: accounts with no sign-in for 90 days are deleted. If you don't sign in by 5 November 2026",
    );
    expect(accountEmailContent("inactivity_warning", { ...params, language: "de" }).text).toContain("Wenn du dich nicht bis zum 5. November 2026 anmeldest");
    expect(accountEmailContent("deleted", { appUrl: "https://x", language: "en" }).text).toContain("This is the last email you'll receive from us.");
    expect(accountEmailContent("inactivity_deleted", { appUrl: "https://x", language: "de" }).text).toContain("innerhalb von 14 Tagen überschrieben");
  });
});
