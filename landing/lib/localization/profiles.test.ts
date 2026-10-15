import { describe, expect, it } from "vitest";
import { detectProfile, resolveProfile, pagePath, availablePage, profileFromPath } from "./profiles";
import { translatedData } from "./index";
import en from "./en.json";
import de from "./de.json";
import { GERMAN_COPY } from "./country-copy";

describe("landing country and language", () => {
 it.each([
  [["de-DE", "en"], "DE", "de"],
  [["en-DE", "de"], "DE", "en"],
  [["it-IT", "en"], "IT", "it"],
  [["en-IT"], "IT", "en"],
  [["de"], "DE", "de"],
  [["fr-FR"], "IT", "en"],
  [["not_a_locale", "de-DE"], "DE", "de"],
  [[], "IT", "en"],
 ])("detects %j as %s/%s", (languages, country, language) => {
  expect(detectProfile(languages as string[])).toMatchObject({country, language});
 });
 it("keeps product country when the previous language is unsupported", () => {
  expect(resolveProfile("DE", "it")).toMatchObject({country:"DE",language:"en"});
  expect(resolveProfile("IT", "de")).toMatchObject({country:"IT",language:"en"});
 });
 it("recognises only complete profile segments and preserves deep paths", () => {
  expect(profileFromPath("/de/deep")).toBeUndefined();
  expect(pagePath("/de/en/strumenti/piano-ammortamento")).toBe("/strumenti/piano-ammortamento");
  expect(availablePage("DE","/guide/zainetto-fiscale/")).toBe(false);
  expect(availablePage("IT","/guide/zainetto-fiscale")).toBe(true);
 });
 it("preserves metadata URL instances", () => {
  const url=new URL("https://buddybudget.io");
  expect(translatedData({metadataBase:url}).metadataBase).toBe(url);
 });
 it("translates every German product override in both supported languages", () => {
  for(const text of Object.values(GERMAN_COPY)) {
   expect(en, text).toHaveProperty(text);
   expect(de, text).toHaveProperty(text);
  }
 });
});
