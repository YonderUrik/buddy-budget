import { describe, expect, it } from "vitest";
import { LEGAL_VERSION } from "@/lib/legal";
import { accountGate, accountGateErrorBody } from "./gates";

const active = { onboardingCompleted: true, deletionScheduledAt: null, legalAcceptedVersion: LEGAL_VERSION };

describe("accountGate", () => {
  it("lets an onboarded user with the current legal version through", () => {
    expect(accountGate(active)).toBeNull();
  });

  it("applies the gates in the proxy's order", () => {
    expect(accountGate({ ...active, deletionScheduledAt: new Date(), legalAcceptedVersion: null })).toBe("account_deactivated");
    expect(accountGate({ ...active, legalAcceptedVersion: "2020-01-01" })).toBe("legal_acceptance_required");
    expect(accountGate({ ...active, onboardingCompleted: false, legalAcceptedVersion: null })).toBe("onboarding_required");
  });

  it("gives the gate 403s stable codes, with the version to accept", () => {
    expect(accountGateErrorBody("account_deactivated")).toEqual({ code: "account_deactivated" });
    expect(accountGateErrorBody("legal_acceptance_required")).toEqual({ code: "legal_acceptance_required", version: LEGAL_VERSION });
  });
});
