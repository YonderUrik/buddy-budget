import { describe, expect, it } from "vitest";
import {
  PUBLIC_DEMO_BLOCKED_AUTH_PATHS,
  isPublicDemoEnabled,
  isPublicDemoUserId,
  isReadOnlyMethod,
  PUBLIC_DEMO_PROFILES,
  pickPublicDemoProfile,
  publicDemoSessionProfile,
  publicDemoUserId,
} from "./config";

describe("public demo config", () => {
  it("recognises demo ids only by their prefix", () => {
    expect(publicDemoUserId({ productCountry: "DE", language: "en" })).toBe("public-demo-de-en");
    expect(isPublicDemoUserId("public-demo-it-it")).toBe(true);
    expect(isPublicDemoUserId("demo-user")).toBe(false);
    expect(isPublicDemoUserId("Xk2l9")).toBe(false);
    expect(isPublicDemoUserId(undefined)).toBe(false);
  });

  it("has one demo per country and language the app supports", () => {
    expect(PUBLIC_DEMO_PROFILES.map(publicDemoUserId)).toEqual(["public-demo-it-it", "public-demo-it-en", "public-demo-de-en", "public-demo-de-de", "public-demo-other-en"]);
  });

  it("is off unless explicitly enabled", () => {
    expect(isPublicDemoEnabled({})).toBe(false);
    expect(isPublicDemoEnabled({ PUBLIC_DEMO_ENABLED: "1" })).toBe(false);
    expect(isPublicDemoEnabled({ PUBLIC_DEMO_ENABLED: "true" })).toBe(true);
  });

  it("picks the demo from the query, then the browser's language", () => {
    expect(pickPublicDemoProfile(null, "de", "it-IT")).toEqual({ productCountry: "DE", language: "de" });
    expect(pickPublicDemoProfile(null, "en", null)).toEqual({ productCountry: "IT", language: "en" });
    expect(pickPublicDemoProfile("DE", "en", null)).toEqual({ productCountry: "DE", language: "en" });
    expect(pickPublicDemoProfile("IT", "de", null)).toEqual({ productCountry: "IT", language: "it" });
    expect(pickPublicDemoProfile("DE", null, "it-IT")).toEqual({ productCountry: "DE", language: "de" });
    expect(pickPublicDemoProfile("DE", null, "en-US")).toEqual({ productCountry: "DE", language: "en" });
    expect(pickPublicDemoProfile(null, "fr", "it-IT,it;q=0.9")).toEqual({ productCountry: "IT", language: "it" });
    expect(pickPublicDemoProfile("XX", null, "fr-FR,de;q=0.8")).toEqual({ productCountry: "DE", language: "de" });
    expect(pickPublicDemoProfile(null, null, null)).toEqual({ productCountry: "IT", language: "it" });
  });

  it("opens the demo of the visitor's country: English without local rules outside Italy and Germany", () => {
    expect(pickPublicDemoProfile(null, null, "it-IT", "US")).toEqual({ productCountry: "OTHER", language: "en" });
    expect(pickPublicDemoProfile(null, "en", null, "US")).toEqual({ productCountry: "OTHER", language: "en" });
    expect(pickPublicDemoProfile(null, null, "en-US", "IT")).toEqual({ productCountry: "IT", language: "it" });
    expect(pickPublicDemoProfile(null, null, null, "DE")).toEqual({ productCountry: "DE", language: "de" });
    expect(pickPublicDemoProfile(null, "it", null, "US")).toEqual({ productCountry: "IT", language: "it" });
    expect(pickPublicDemoProfile(null, null, null, "AT")).toEqual({ productCountry: "DE", language: "de" });
    expect(pickPublicDemoProfile("OTHER", "de", null, "US")).toEqual({ productCountry: "OTHER", language: "en" });
    expect(pickPublicDemoProfile("IT", null, null, "US")).toEqual({ productCountry: "IT", language: "en" });
  });

  it("reads the profile of a demo session, English for Italy when it is missing", () => {
    expect(publicDemoSessionProfile({ language: "en", productCountry: "DE" })).toEqual({ productCountry: "DE", language: "en" });
    expect(publicDemoSessionProfile({ language: null, productCountry: null })).toEqual({ productCountry: "IT", language: "en" });
  });

  it("allows reads and blocks account changes", () => {
    expect(isReadOnlyMethod("GET")).toBe(true);
    expect(isReadOnlyMethod("POST")).toBe(false);
    expect(isReadOnlyMethod("DELETE")).toBe(false);
    expect(PUBLIC_DEMO_BLOCKED_AUTH_PATHS.has("/delete-user")).toBe(true);
    expect(PUBLIC_DEMO_BLOCKED_AUTH_PATHS.has("/sign-out")).toBe(false);
  });
});
