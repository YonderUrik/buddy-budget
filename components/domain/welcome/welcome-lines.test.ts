import { describe, expect, it } from "vitest";
import { translate } from "@/lib/localization/messages";
import { happenedLine, waitingLine, welcomeLabel } from "./welcome-lines";

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

describe("welcomeLabel", () => {
  const movements = happenedLine({ kind: "movements", count: 12 }, it_);
  const alerts = happenedLine({ kind: "price_alerts", count: 1 }, it_);
  const toDecide = waitingLine({ kind: "to_decide", count: 7 }, it_);

  it("names the first thing that happened and says when the summary has more", () => {
    expect(welcomeLabel([movements, alerts], [toDecide], it_)).toBe("12\u00a0movimenti nuovi e altro");
    expect(welcomeLabel([movements], [toDecide], it_)).toBe("12\u00a0movimenti nuovi e altro");
    expect(welcomeLabel([movements], [], it_)).toBe("12\u00a0movimenti nuovi");
    expect(welcomeLabel([happenedLine({ kind: "movements", count: 1 }, en)], [waitingLine({ kind: "to_decide", count: 7 }, en)], en)).toBe(
      "1\u00a0new movement and more"
    );
  });

  it("says nothing when only the backlog waits: it is not news", () => {
    expect(welcomeLabel([], [toDecide], it_)).toBeNull();
    expect(welcomeLabel([], [], it_)).toBeNull();
  });
});
