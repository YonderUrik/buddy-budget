import { describe, expect, it } from "vitest";
import { RECENT_LOGIN_MAX_AGE_MINUTES } from "./constants";
import { isRecentLogin, recentLoginExpiresAt } from "./recent-login";
import { DEFAULT_HOME_PAGE, isHomePagePath, resolveHomePage } from "./home-pages";
import { describeUserAgent, formatDevice } from "./user-agent";
import { decimal, toCsv } from "./csv";

const MINUTE = 60_000;

describe("isRecentLogin", () => {
  const created = new Date("2026-09-29T10:00:00Z");

  it("vale fino a RECENT_LOGIN_MAX_AGE_MINUTES minuti compresi", () => {
    expect(isRecentLogin(created, new Date(created.getTime() + MINUTE))).toBe(true);
    expect(isRecentLogin(created, new Date(created.getTime() + RECENT_LOGIN_MAX_AGE_MINUTES * MINUTE))).toBe(true);
  });

  it("scade subito dopo la soglia", () => {
    expect(isRecentLogin(created, new Date(created.getTime() + RECENT_LOGIN_MAX_AGE_MINUTES * MINUTE + 1))).toBe(false);
  });

  it("non considera recente una sessione con data nel futuro (orologi sfasati o dati manomessi)", () => {
    expect(isRecentLogin(created, new Date(created.getTime() - MINUTE))).toBe(false);
  });

  it("recentLoginExpiresAt è la fine della finestra", () => {
    expect(recentLoginExpiresAt(created).getTime() - created.getTime()).toBe(RECENT_LOGIN_MAX_AGE_MINUTES * MINUTE);
  });
});

describe("pagina iniziale", () => {
  it("accetta solo le pagine previste", () => {
    expect(isHomePagePath("/transazioni")).toBe(true);
    expect(isHomePagePath("/impostazioni")).toBe(false);
    expect(isHomePagePath("https://evil.example")).toBe(false);
    expect(isHomePagePath(42)).toBe(false);
  });

  it("ripiega sul default con valori mancanti o non più validi", () => {
    expect(resolveHomePage("/investimenti")).toBe("/investimenti");
    expect(resolveHomePage("/pensione")).toBe(DEFAULT_HOME_PAGE);
    expect(resolveHomePage(null)).toBe(DEFAULT_HOME_PAGE);
  });
});

describe("describeUserAgent", () => {
  it.each([
    [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36",
      "Chrome su macOS",
      false,
    ],
    [
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Safari su iOS",
      true,
    ],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0", "Edge su Windows", false],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36", "Chrome su Android", true],
    ["Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0", "Firefox su Linux", false],
  ])("%s → %s", (ua, label, mobile) => {
    const device = describeUserAgent(ua);
    expect(formatDevice(device)).toBe(label);
    expect(device.mobile).toBe(mobile);
  });

  it("gestisce uno user agent assente", () => {
    expect(formatDevice(describeUserAgent(null))).toBe("Browser sconosciuto su sistema sconosciuto");
  });
});

describe("toCsv", () => {
  it("usa ; come separatore, BOM, CRLF e virgolette dove servono", () => {
    const csv = toCsv([{ a: 'Bar "Da Mario"; centro', b: 3.5 }], [
      { header: "Descrizione", value: (r) => r.a },
      { header: "Importo", value: (r) => r.b },
    ]);
    expect(csv).toBe('﻿Descrizione;Importo\r\n"Bar ""Da Mario""; centro";3,5\r\n');
  });

  it("neutralizza le formule ma non i numeri negativi", () => {
    const csv = toCsv([{ v: "=HYPERLINK(\"x\")" }, { v: decimal("-12.50") }, { v: "+39 333" }], [{ header: "V", value: (r) => r.v }]);
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    expect(lines[1]).toBe(`"'=HYPERLINK(""x"")"`);
    expect(lines[2]).toBe("-12,50");
    expect(lines[3]).toBe("'+39 333");
  });

  it("valori vuoti, booleani e date", () => {
    const csv = toCsv([{ n: null, b: true, d: new Date("2026-01-02T03:04:05Z") }], [
      { header: "N", value: (r) => r.n },
      { header: "B", value: (r) => r.b },
      { header: "D", value: (r) => r.d },
    ]);
    expect(csv.split("\r\n")[1]).toBe(";sì;2026-01-02T03:04:05.000Z");
  });
});
