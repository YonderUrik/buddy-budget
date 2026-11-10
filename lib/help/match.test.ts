import { describe, expect, it } from "vitest";
import en from "@/lib/localization/catalogs/en.json";
import de from "@/lib/localization/catalogs/de.json";
import { HELP_ARTICLES } from "./articles";
import { cleanHelpIds, isHelpQuestion, matchHelp } from "./match";

const it_ = (key: string) => key;
const toEn = (key: string) => (en as Record<string, string>)[key] ?? key;
const toDe = (key: string) => (de as Record<string, string>)[key] ?? key;
const ids = (text: string, country = "IT", translate = it_) => matchHelp(text, country, translate).map((a) => a.id);

describe("isHelpQuestion", () => {
  it("recognises «how do I / what is» questions in the three languages", () => {
    for (const text of ["Come importo un csv?", "posso collegare la banca", "Perché il prezzo è vecchio?", "cos'è un giroconto", "How do I hide amounts?", "can I connect my bank", "Wie lösche ich einen Import?", "Was sieht die KI?"]) {
      expect(isHelpQuestion(text), text).toBe(true);
    }
  });

  it("leaves questions about the user's figures and plain searches to the rest of «Cerca»", () => {
    for (const text of ["quanto ho speso da Netflix", "How much did I spend on food?", "Wie viel habe ich ausgegeben?", "netflix", "pagato 12 € al bar ieri", "media spesa al mese", "comodino ikea"]) {
      expect(isHelpQuestion(text), text).toBe(false);
    }
  });
});

describe("matchHelp", () => {
  it("finds the article whatever the ending or the language", () => {
    expect(ids("come importo un csv")[0]).toBe("import-csv");
    // «importo» is not «imposto»: the budget article stays out.
    expect(ids("come importo un csv")).not.toContain("budget");
    expect(ids("come nascondo gli importi")[0]).toBe("nascondi-importi");
    expect(ids("how do I hide amounts", "IT", toEn)[0]).toBe("nascondi-importi");
    expect(ids("wie blende ich Beträge aus", "DE", toDe)[0]).toBe("nascondi-importi");
    expect(ids("come creo un obiettivo")[0]).toBe("obiettivo");
    expect(ids("come conto solo la mia parte di una spesa condivisa")[0]).toBe("dividi");
  });

  it("shows at most three answers and nothing for an unknown topic", () => {
    expect(ids("come funziona").length).toBeLessThanOrEqual(3);
    expect(ids("come cucino la carbonara")).toEqual([]);
    expect(ids("come")).toEqual([]);
  });

  it("hides articles about screens closed in the user's country", () => {
    expect(ids("come aggiungo il fondo pensione")).toContain("pensione");
    expect(ids("how do I add my pension fund", "OTHER", toEn)).not.toContain("pensione");
    expect(cleanHelpIds(["pensione", "budget"], "OTHER")).toEqual(["budget"]);
    expect(cleanHelpIds(["budget", "budget", "nope", "regole", "dividi", "abbonamenti"], "IT")).toEqual(["budget", "regole", "dividi"]);
  });

  it("has unique ids and every article translated", () => {
    expect(new Set(HELP_ARTICLES.map((a) => a.id)).size).toBe(HELP_ARTICLES.length);
    for (const article of HELP_ARTICLES) {
      for (const text of [article.question, article.answer]) {
        expect(toEn(text), text).not.toBe(text);
        expect(toDe(text), text).not.toBe(text);
      }
    }
  });
});
