import { describe, expect, it } from "vitest";
import { devToolRefusal, isDisposableTestEmail } from "./mobile-session-guard";

const LOCAL = "postgresql://postgres:pw@127.0.0.1:55439/buddy_local";

describe("devToolRefusal", () => {
  it("allows a local database outside production", () => {
    expect(devToolRefusal({ nodeEnv: undefined, databaseUrl: LOCAL })).toBeNull();
    expect(devToolRefusal({ nodeEnv: "development", databaseUrl: "postgres://u:p@localhost/db" })).toBeNull();
    expect(devToolRefusal({ nodeEnv: "test", databaseUrl: "postgres://u:p@[::1]:5432/db" })).toBeNull();
  });

  it("refuses in production, even against localhost", () => {
    expect(devToolRefusal({ nodeEnv: "production", databaseUrl: LOCAL })).toBe("production");
  });

  it("refuses remote, missing or malformed database URLs", () => {
    expect(devToolRefusal({ databaseUrl: "postgres://u:p@db.internal:5432/app" })).toBe("non_local_database");
    expect(devToolRefusal({ databaseUrl: "postgres://u:p@localhost.evil.example:5432/app" })).toBe("non_local_database");
    expect(devToolRefusal({ databaseUrl: undefined })).toBe("missing_database_url");
    expect(devToolRefusal({ databaseUrl: "not a url" })).toBe("invalid_database_url");
  });
});

describe("isDisposableTestEmail", () => {
  it("accepts only reserved test domains", () => {
    expect(isDisposableTestEmail("mobile-dev@buddybudget.test")).toBe(true);
    expect(isDisposableTestEmail("someone@Example.com")).toBe(true);
    expect(isDisposableTestEmail("mario@gmail.com")).toBe(false);
    expect(isDisposableTestEmail("no-at-sign")).toBe(false);
  });
});
