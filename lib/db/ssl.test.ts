import { describe, expect, it } from "vitest";
import { resolveDbSsl } from "./ssl";

describe("resolveDbSsl", () => {
  it("in produzione richiede TLS se l'URL non dice nulla", () => {
    expect(resolveDbSsl("postgresql://u:p@db:5432/app", "production")).toBe("require");
  });

  it("lascia decidere all'URL quando sslmode è esplicito (anche disable, opt-out consapevole)", () => {
    expect(resolveDbSsl("postgresql://u:p@db:5432/app?sslmode=require", "production")).toBeUndefined();
    expect(resolveDbSsl("postgresql://u:p@db:5432/app?sslmode=disable", "production")).toBeUndefined();
  });

  it("fuori produzione non impone TLS (Postgres locale senza certificati)", () => {
    expect(resolveDbSsl("postgresql://u:p@localhost:5432/app", "development")).toBeUndefined();
    expect(resolveDbSsl("postgresql://u:p@localhost:5432/app", undefined)).toBeUndefined();
  });
});
