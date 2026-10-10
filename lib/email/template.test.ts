import { describe, expect, it } from "vitest";
import { escapeHtml, renderEmail } from "./template";

const OPTIONS = { appUrl: "https://app.example.test" };

describe("renderEmail", () => {
  it("mette titolo, frase in grassetto, bottone e nota nell'HTML", () => {
    const { html } = renderEmail(
      { title: "Avviso", lead: "Chiusura **118,40 €** ieri.", cta: { label: "Apri", url: "https://app.example.test/x" }, footnote: "Nota." },
      OPTIONS,
    );
    expect(html).toContain("Avviso");
    expect(html).toMatch(/<b [^>]*>118,40 €<\/b>/);
    expect(html).toContain('href="https://app.example.test/x"');
    expect(html).toContain("Nota.");
  });

  it("carica logo e font dall'app e prevede il tema scuro", () => {
    const { html } = renderEmail({ title: "T", lead: "L" }, OPTIONS);
    expect(html).toContain("https://app.example.test/brand/email/logo-mark.png");
    expect(html).toContain("https://app.example.test/brand/email/space-grotesk-latin-400-normal.woff2");
    expect(html).toContain("prefers-color-scheme:dark");
  });

  it("nella versione testo toglie il grassetto e riporta il link", () => {
    const { text } = renderEmail({ title: "Titolo", lead: "Vale **10 minuti**.", cta: { label: "Accedi", url: "https://a.test/l" } }, OPTIONS);
    expect(text).toBe("Titolo\n\nVale 10 minuti.\n\nAccedi: https://a.test/l");
  });

  it("neutralizza l'HTML nei testi che arrivano da fuori", () => {
    const { html } = renderEmail({ title: "<b>x</b>", lead: "Banca <script>alert(1)</script> & co" }, OPTIONS);
    expect(html).not.toContain("<script>");
    expect(html).toContain("Banca &lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
  });

  it("senza bottone non lascia spazio sotto la frase", () => {
    expect(renderEmail({ title: "T", lead: "L" }, OPTIONS).html).toContain("margin:0 0 0px");
  });
});

describe("escapeHtml", () => {
  it("converte i cinque caratteri speciali", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
