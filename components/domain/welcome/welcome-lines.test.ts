import { describe, expect, it } from "vitest";
import { translate } from "@/lib/localization/messages";
import { happenedLine, waitingLine, welcomeToastContent } from "./welcome-lines";

const it_ = (source: string, values?: Record<string, string | number>) => translate("it", source, values);
const en = (source: string, values?: Record<string, string | number>) => translate("en", source, values);

describe("happenedLine", () => {
  it("names what happened with the right number", () => {
    expect(happenedLine({ kind: "movements", count: 12 }, it_)).toMatchObject({ figure: 12, title: "movimenti nuovi", href: "/liquidita" });
    expect(happenedLine({ kind: "movements", count: 1 }, en).title).toBe("new movement");
    expect(happenedLine({ kind: "price_alerts", count: 1 }, it_).title).toBe("avviso di prezzo scattato");
    expect(happenedLine({ kind: "price_rises", count: 2 }, it_)).toMatchObject({ title: "abbonamenti costano di più", href: "/liquidita/abbonamenti" });
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
  const movements = happenedLine({ kind: "movements", count: 12 }, it_);
  const alerts = happenedLine({ kind: "price_alerts", count: 1 }, it_);
  const toDecide = waitingLine({ kind: "to_decide", count: 7 }, it_);
  const subscriptions = waitingLine({ kind: "subscriptions", count: 1 }, it_);

  it("says what happened and everything that waits as one count, on one line, with the action of the first thing that waits", () => {
    expect(welcomeToastContent([movements, alerts], [toDecide, subscriptions], it_)).toEqual({
      line: "12\u00a0movimenti nuovi · 8\u00a0da sistemare",
      action: { label: "Decidi", href: "/categorizza", kind: "to_decide" },
    });
    const english = welcomeToastContent([happenedLine({ kind: "movements", count: 12 }, en)], [waitingLine({ kind: "to_decide", count: 7 }, en)], en);
    expect(english?.line).toBe("12\u00a0new movements · 7\u00a0to sort out");
  });

  it("names a second thing that happened and uses «Vedi» when nothing waits", () => {
    expect(welcomeToastContent([movements, alerts], [], it_)).toEqual({
      line: "12\u00a0movimenti nuovi · 1\u00a0avviso di prezzo scattato",
      action: { label: "Vedi", href: "/liquidita", kind: "movements" },
    });
    expect(welcomeToastContent([movements], [], it_)?.line).toBe("12\u00a0movimenti nuovi");
  });

  it("says nothing when only the backlog waits: it is not news", () => {
    expect(welcomeToastContent([], [toDecide], it_)).toBeNull();
    expect(welcomeToastContent([], [], it_)).toBeNull();
  });
});
