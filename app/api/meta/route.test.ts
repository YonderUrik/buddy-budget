import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appMetaSchema, buildWhatsNew, whatsNewSchema } from "@/lib/views";
import { WHATS_NEW_ENTRIES } from "@/lib/whats-new/entries";
import { LEGAL_VERSION } from "@/lib/legal/version";

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from "@/lib/auth";
import { GET } from "./route";
import { GET as getWhatsNew } from "../whats-new/route";

const mockedGetSession = vi.mocked(auth.api.getSession);
const get = (query = "", headers: Record<string, string> = {}) => GET(new NextRequest(`http://localhost/api/meta${query}`, { headers }));

describe("GET /api/meta", () => {
  afterEach(() => mockedGetSession.mockReset());

  it("is public: constants, capabilities per country and legal metadata, cacheable", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    const response = await get("?language=en");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("public");
    const meta = appMetaSchema.parse(await response.json());
    expect(meta).toMatchObject({ language: "en", profile: null, legal: { version: LEGAL_VERSION }, defaultCurrency: "EUR" });
    expect(meta.countries.find((c) => c.id === "DE")).toMatchObject({ languages: ["en", "de"], sections: { pension: false, investmentTaxes: true, financialPlanning: true }, planning: { tax: true, pension: false } });
    expect(meta.countries.find((c) => c.id === "IT")?.sections).toMatchObject({ pension: true, financialPlanning: false });
    expect(meta.currencies.find((c) => c.value === "USD")?.label).not.toBe("Dollaro USA");
    expect(meta.limits).toMatchObject({ transactionsPageMax: 200, goalsMax: 20, bankSyncsPerDay: 4 });
    expect(meta.features.every((f) => f.available === null)).toBe(true);
  });

  it("before sign-in, country and language ask for a profile (onboarding category proposal)", async () => {
    mockedGetSession.mockResolvedValue(null as never);
    const meta = appMetaSchema.parse(await (await get("?country=DE&language=de")).json());
    expect(meta.profile).toMatchObject({ productCountry: "DE", language: "de", capabilities: { id: "DE" } });
    expect(meta.profile?.categoryProposal.length).toBeGreaterThan(0);
    expect(await (await get("?country=DE&language=it")).json()).toMatchObject({ code: "validation_failed", field: "country" });
    expect(await (await get("?language=fr")).json()).toMatchObject({ code: "validation_failed", field: "language" });
  });

  it("with a session, follows the user's profile and is private", async () => {
    mockedGetSession.mockResolvedValue({ user: { id: "u", productCountry: "DE", language: "en" } } as never);
    const response = await get("?language=it");
    expect(response.headers.get("cache-control")).toContain("private");
    const meta = appMetaSchema.parse(await response.json());
    expect(meta).toMatchObject({ language: "en", profile: { productCountry: "DE", language: "en" } });
    expect(meta.features.find((f) => f.appPath === "/pensione")?.available).toBe(false);
  });
});

describe("GET /api/whats-new", () => {
  it("requires a session and filters by country and dismissals", async () => {
    mockedGetSession.mockResolvedValueOnce(null as never);
    expect((await getWhatsNew(new NextRequest("http://localhost/api/whats-new"))).status).toBe(401);
    mockedGetSession.mockResolvedValue({ user: { id: "u", productCountry: "IT", language: "it" } } as never);
    const body = whatsNewSchema.parse(await (await getWhatsNew(new NextRequest("http://localhost/api/whats-new"))).json());
    expect(body.maxAgeDays).toBe(45);
  });

  it("buildWhatsNew: newest fresh entry, dismissed and other-country entries left out, localized", () => {
    const [newest, older] = WHATS_NEW_ENTRIES;
    const now = new Date(`${newest!.date}T12:00:00Z`);
    const it = buildWhatsNew({ language: "it", productCountry: "IT", dismissed: [], now });
    expect(it.current?.id).toBe(newest!.id);
    expect(buildWhatsNew({ language: "it", productCountry: "IT", dismissed: [newest!.id], now }).current?.id).toBe(older!.id);
    // Goals are available in every country since #465.
    expect(buildWhatsNew({ language: "en", productCountry: "DE", dismissed: [], now }).entries.map((e) => e.id)).toContain("obiettivi-di-risparmio");
    expect(buildWhatsNew({ language: "it", productCountry: "IT", dismissed: [], now: new Date("2030-01-01") })).toMatchObject({ entries: [], current: null });
  });
});
