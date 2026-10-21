import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { HOME_PATH, PAGE_PAIRS } from "@/content/locales";
import {
  AUTO_SWITCH_FLAG,
  autoLanguageScript,
  autoLanguageTarget,
  countryFromCookie,
  countryLanguage,
  countryRules,
  hiddenIn,
  LANGUAGE_CHOICE_STORAGE_KEY,
  needsAttr,
  parseCountry,
  RULES_SCRIPT,
  rulesTexts,
  rulesVariant,
} from "./visitor-country";

const PAIRS = Object.fromEntries(PAGE_PAIRS.map((p) => [p.it, p.en]));
const FALLBACK = HOME_PATH.en;

describe("parseCountry", () => {
  it("keeps real two-letter codes only", () => {
    expect(parseCountry("US")).toBe("US");
    expect(parseCountry("XX")).toBeNull();
    expect(parseCountry("T1")).toBeNull();
    expect(parseCountry("us")).toBeNull();
    expect(parseCountry("")).toBeNull();
    expect(parseCountry(undefined)).toBeNull();
  });

  it("reads the cookie among others", () => {
    expect(countryFromCookie("a=1; bb-country=DE; b=2")).toBe("DE");
    expect(countryFromCookie("bb-country=XX")).toBeNull();
    expect(countryFromCookie("x-bb-country=US")).toBeNull();
    expect(countryFromCookie("")).toBeNull();
  });
});

describe("countryLanguage", () => {
  it("lands on Italian only in Italian-speaking countries", () => {
    for (const c of ["IT", "SM", "VA"]) expect(countryLanguage(c)).toBe("it");
    for (const c of ["US", "DE", "FR", "GB", "AT"]) expect(countryLanguage(c, "it-IT")).toBe("en");
  });

  it("treats Switzerland as Italian only with an Italian browser", () => {
    expect(countryLanguage("CH", "it-CH")).toBe("it");
    expect(countryLanguage("CH", "de-CH")).toBe("en");
    expect(countryLanguage("CH", "")).toBe("en");
  });
});

describe("countryRules and variants", () => {
  it("maps countries to rules", () => {
    expect(countryRules("IT")).toBe("it");
    expect(countryRules("VA")).toBe("it");
    expect(countryRules("DE")).toBe("de");
    expect(countryRules("US")).toBe("none");
    expect(countryRules("CH")).toBe("none");
    expect(rulesVariant(null)).toBe("full");
    expect(rulesVariant("it")).toBe("full");
    expect(rulesVariant("de")).toBe("de");
  });

  it("hides pension outside Italy and taxes only without rules", () => {
    expect(hiddenIn("pension", "full")).toBe(false);
    expect(hiddenIn("pension", "de")).toBe(true);
    expect(hiddenIn("pension", "none")).toBe(true);
    expect(hiddenIn("taxes", "de")).toBe(false);
    expect(hiddenIn("taxes", "none")).toBe(true);
    expect(hiddenIn(undefined, "none")).toBe(false);
    expect(needsAttr(["pension", "taxes"])).toBe("pension taxes");
    expect(needsAttr(undefined)).toBeUndefined();
  });

  it("groups the versions of a text", () => {
    expect(rulesTexts("same")).toEqual([{ text: "same", variants: ["full", "de", "none"] }]);
    expect(rulesTexts({ full: "a", de: "b" })).toEqual([
      { text: "a", variants: ["full"] },
      { text: "b", variants: ["de", "none"] },
    ]);
    expect(rulesTexts({ full: "a", none: "c" })).toEqual([
      { text: "a", variants: ["full", "de"] },
      { text: "c", variants: ["none"] },
    ]);
  });
});

describe("autoLanguageTarget", () => {
  const base = { path: "/", search: "", hash: "", country: "US", browserLanguage: "en-US", choice: null, pairs: PAIRS, fallback: FALLBACK };

  it("sends a visitor from outside Italy to the English counterpart, keeping query and hash", () => {
    expect(autoLanguageTarget(base)).toBe("/en");
    expect(autoLanguageTarget({ ...base, path: "/strumenti/zainetto-fiscale", search: "?utm_source=x", hash: "#a" })).toBe("/en/calculators/zainetto-fiscale?utm_source=x#a");
    expect(autoLanguageTarget({ ...base, path: "/non-esiste" })).toBe("/en");
    expect(autoLanguageTarget({ ...base, country: "DE" })).toBe("/en");
  });

  it("stays without cookie, with ?lang=, after choosing Italian, in Italy, and on English paths", () => {
    expect(autoLanguageTarget({ ...base, country: null })).toBeNull();
    expect(autoLanguageTarget({ ...base, search: "?lang=it" })).toBeNull();
    expect(autoLanguageTarget({ ...base, choice: "it" })).toBeNull();
    expect(autoLanguageTarget({ ...base, country: "IT" })).toBeNull();
    expect(autoLanguageTarget({ ...base, country: "CH", browserLanguage: "it-CH" })).toBeNull();
    expect(autoLanguageTarget({ ...base, path: "/en/foo" })).toBeNull();
  });

  it("maps every Italian page to its pair", () => {
    for (const pair of PAGE_PAIRS) expect(autoLanguageTarget({ ...base, path: pair.it })).toBe(pair.en);
  });
});

interface Env {
  cookie?: string;
  path?: string;
  search?: string;
  hash?: string;
  languages?: string[];
  choice?: string | null;
  storageThrows?: boolean;
}

/** Runs an inline script against a fake browser and reports what it did. */
function run(script: string, env: Env = {}) {
  const dataset: Record<string, string> = {};
  const session: Record<string, string> = {};
  let replaced: string | null = null;
  const storage = {
    getItem: (k: string) => {
      if (env.storageThrows) throw new Error("blocked");
      return k === LANGUAGE_CHOICE_STORAGE_KEY ? (env.choice ?? null) : null;
    },
  };
  runInNewContext(script, {
    document: { cookie: env.cookie ?? "", documentElement: { dataset, style: {} } },
    location: { pathname: env.path ?? "/", search: env.search ?? "", hash: env.hash ?? "", replace: (u: string) => (replaced = u) },
    navigator: { languages: env.languages ?? ["en-US"], language: (env.languages ?? ["en-US"])[0] },
    localStorage: storage,
    sessionStorage: { setItem: (k: string, v: string) => (session[k] = v) },
    URLSearchParams,
  });
  return { dataset, session, replaced };
}

describe("RULES_SCRIPT", () => {
  it("sets data-rules like countryRules, and nothing without the cookie", () => {
    for (const c of ["IT", "SM", "DE", "US", "CH", "FR"]) expect(run(RULES_SCRIPT, { cookie: `x=1; bb-country=${c}` }).dataset.rules).toBe(countryRules(c));
    expect(run(RULES_SCRIPT).dataset.rules).toBeUndefined();
    expect(run(RULES_SCRIPT, { cookie: "bb-country=XX" }).dataset.rules).toBeUndefined();
    expect(run(RULES_SCRIPT, { cookie: "bb-country=T1" }).dataset.rules).toBeUndefined();
  });
});

describe("autoLanguageScript", () => {
  const script = autoLanguageScript(PAIRS, FALLBACK);

  it("stays small", () => {
    expect(script.length).toBeLessThan(2000);
  });

  it("agrees with autoLanguageTarget", () => {
    const cases: Env[] = [
      { cookie: "bb-country=US" },
      { cookie: "bb-country=US", path: "/sicurezza", search: "?utm_source=a", hash: "#x" },
      { cookie: "bb-country=DE", path: "/funzioni" },
      { cookie: "bb-country=IT" },
      { cookie: "bb-country=SM" },
      { cookie: "bb-country=CH", languages: ["it-CH"] },
      { cookie: "bb-country=CH", languages: ["fr-CH"] },
      { cookie: "bb-country=US", search: "?lang=it" },
      { cookie: "bb-country=US", choice: "it" },
      { cookie: "bb-country=US", choice: "en" },
      { cookie: "bb-country=US", path: "/en/x" },
      { cookie: "bb-country=XX" },
      {},
    ];
    for (const env of cases) {
      const expected = autoLanguageTarget({
        path: env.path ?? "/",
        search: env.search ?? "",
        hash: env.hash ?? "",
        country: countryFromCookie(env.cookie ?? ""),
        browserLanguage: (env.languages ?? ["en-US"])[0],
        choice: env.choice ?? null,
        pairs: PAIRS,
        fallback: FALLBACK,
      });
      const result = run(script, env);
      expect(result.replaced, JSON.stringify(env)).toBe(expected);
      expect(result.session[AUTO_SWITCH_FLAG] === "1", JSON.stringify(env)).toBe(expected !== null);
    }
  });

  it("does not move when storage is blocked", () => {
    expect(run(script, { cookie: "bb-country=US", storageThrows: true }).replaced).toBeNull();
  });
});
