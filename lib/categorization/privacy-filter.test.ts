import { describe, expect, it } from "vitest";
import { prepareMerchantForModel } from "./privacy-filter";

describe("prepareMerchantForModel", () => {
  it("removes bank boilerplate while keeping a usable label", () => {
    const prepared = prepareMerchantForModel("DECATHLON 00000224 GRUGLIASCO IT Carta N. ***** 249 Data operazione 01/02/25");
    expect(prepared.name).not.toMatch(/Carta|Data|\*/i);
    expect(prepared.name.toLowerCase()).toContain("decathlon");
  });
  it("keeps the counterparty behind a payment intermediary", () => {
    expect(prepareMerchantForModel("PAYPAL *MARIO ROSSI")).toEqual({ name: "Mario Rossi", blocked: null });
  });
  it.each([
    "Mario Rossi", "Rossi Mario Torino", "De Florio Marianna", "GABRIELE STREE", "Vito a San Luca",
    "PAYPAL *TICKETRAUS TIC", "Hostel World", "Pizza Teigmeister", "Sönmez Baklava",
    "Bonifico a favore di Mario Rossi", "Bonifico a favore di DB Vertrieb GmbH", "Giroconto",
    "Prelievo contanti", "Versamento Contanti Atm", "Stipendio Acme", "F24", "Imposta di bollo", "Ricarica",
  ])("accepts every name and transaction type: %s", (description) => {
    const prepared = prepareMerchantForModel(description);
    expect(prepared.blocked).toBeNull();
    expect(prepared.name.length).toBeGreaterThan(0);
  });
});
