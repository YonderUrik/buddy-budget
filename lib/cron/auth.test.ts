import { describe, expect, it } from "vitest";
import { isAuthorizedCronRequest } from "./auth";

const SECRET = "s".repeat(40);

describe("isAuthorizedCronRequest", () => {
  it("accetta il Bearer esatto", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it("rifiuta header assente, segreto sbagliato o schema diverso", () => {
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${"x".repeat(40)}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}extra`, SECRET)).toBe(false);
  });

  it("rifiuta sempre se il segreto non è configurato o è troppo corto", () => {
    expect(isAuthorizedCronRequest("Bearer ", "")).toBe(false);
    expect(isAuthorizedCronRequest("Bearer undefined", undefined)).toBe(false);
    expect(isAuthorizedCronRequest("Bearer corto", "corto")).toBe(false);
  });
});
