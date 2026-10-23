import { describe, expect, it } from "vitest";
import robots from "./robots";

describe("robots.txt dell'app", () => {
  it("blocca tutto tranne /login, che deve restare leggibile per il suo noindex", () => {
    expect(robots().rules).toEqual({ userAgent: "*", allow: "/login", disallow: "/" });
  });
});
