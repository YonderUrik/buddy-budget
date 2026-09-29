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
