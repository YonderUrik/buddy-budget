import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { LEGAL_LINKS, LEGAL_VERSION, PRIVACY_EMAIL } from "@/lib/legal";
import { isPublicPath } from "@/proxy";
import { GET } from "./route";

// The proxy module imports the auth instance; only its public path list is used here.
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

const call = (query = "", headers: Record<string, string> = {}) => GET(new NextRequest(`http://localhost/api/legal${query}`, { headers }));

describe("GET /api/legal", () => {
  it("is public: it must work before sign-in and while legal-gated", () => {
    expect(isPublicPath("/api/legal")).toBe(true);
  });

  it("returns the current version, the clauses to approve and the document links", async () => {
    const response = await call("?language=it");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
    expect(await response.json()).toEqual({
      version: LEGAL_VERSION,
      language: "it",
      specificClauseSections: ["Responsabilità", "Sospensione e chiusura", "Modifiche ai termini", "Legge applicabile, foro e contatti"],
      documents: LEGAL_LINKS.map((link) => ({ id: link.id, label: link.label, url: link.href })),
      privacyEmail: PRIVACY_EMAIL,
    });
  });

  it("translates labels from ?language= or Accept-Language", async () => {
    const english = await (await call("?language=en")).json();
    expect(english.documents.map((d: { label: string }) => d.label)).toEqual(["Privacy", "Terms", "Cookies"]);
    expect(english.specificClauseSections[0]).toBe("Liability");
    const german = await (await call("", { "Accept-Language": "de-DE,de;q=0.9" })).json();
    expect(german).toMatchObject({ language: "de", version: LEGAL_VERSION });
    expect(german.documents[1].label).toBe("Nutzungsbedingungen");
  });
});
