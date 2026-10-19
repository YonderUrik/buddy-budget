import { describe, expect, it } from "vitest";
import { translate } from "@/lib/localization/messages";
import { happenedLine, waitingLine, welcomeToastContent } from "./welcome-lines";

const it_ = (source: string, values?: Record<string, string | number>) => translate("it", source, values);
const en = (source: string, values?: Record<string, string | number>) => translate("en", source, values);
const fmt = { money: (v: number) => `${v} €`, price: (v: number, c: string) => `${v} ${c}` };

describe("happenedLine", () => {
  it("sums up new movements with income and spending", () => {
    const line = happenedLine({ kind: "movements", count: 12, income: 1240, expenses: 312 }, it_, fmt);
    expect(line).toMatchObject({ figure: 12, title: "movimenti nuovi", detail: "entrate 1240 € · uscite 312 €", href: "/liquidita" });
    expect(happenedLine({ kind: "movements", count: 1, income: 0, expenses: 9 }, en, fmt).title).toBe("new movement");
  });

  it("names the latest price alert", () => {
    const first = { name: "Enel", direction: "sopra" as const, price: 7.2, currency: "EUR" };
    expect(happenedLine({ kind: "price_alerts", count: 1, first }, it_, fmt).detail).toBe("Enel è salito sopra 7.2 EUR");
    expect(happenedLine({ kind: "price_alerts", count: 3, first }, it_, fmt).detail).toBe("L'ultimo: Enel è salito sopra 7.2 EUR");
  });

  it("names the subscription that costs more", () => {
    const line = happenedLine({ kind: "price_rises", count: 1, first: { name: "Netflix", from: 12.99, to: 15.99 } }, it_, fmt);
    expect(line.detail).toBe("Netflix da 12.99 € a 15.99 €");
  });
});

describe("waitingLine", () => {
  it("gives every waiting line an action and opens the import that waits", () => {
    expect(waitingLine({ kind: "to_decide", count: 4 }, it_)).toMatchObject({ title: "movimenti senza categoria", action: "Decidi", href: "/categorizza" });
    expect(waitingLine({ kind: "import_review", count: 1, jobId: "j1" }, it_).href).toBe("/importazioni?job=j1");
    expect(waitingLine({ kind: "subscriptions", count: 2 }, en).action).toBe("Review");
  });
});

describe("welcomeToastContent", () => {
  const movements = happenedLine({ kind: "movements", count: 12, income: 0, expenses: 315 }, it_, fmt);
  const toDecide = waitingLine({ kind: "to_decide", count: 7 }, it_);

  it("puts what happened in the title, what waits below with its action", () => {
    expect(welcomeToastContent([movements], [toDecide], it_)).toEqual({
      title: "Mentre eri via: 12\u00a0movimenti nuovi",
      description: "Da sistemare: 7\u00a0movimenti senza categoria",
      action: { label: "Decidi", href: "/categorizza", kind: "to_decide" },
    });
  });

  it("uses the detail and a «Vedi» when only one group has something", () => {
    expect(welcomeToastContent([movements], [], it_)).toMatchObject({ description: "uscite 315 €", action: { label: "Vedi", href: "/liquidita" } });
    expect(welcomeToastContent([], [toDecide], it_)?.title).toBe("Da sistemare: 7\u00a0movimenti senza categoria");
    expect(welcomeToastContent([], [], it_)).toBeNull();
  });
});
