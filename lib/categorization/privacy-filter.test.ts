import { describe, expect, it } from "vitest";
import { prepareMerchantForModel } from "./privacy-filter";

describe("prepareMerchantForModel", () => {
  it("toglie il testo di contorno della carta", () => {
    const prepared = prepareMerchantForModel("DECATHLON 00000224 GRUGLIASCO IT Carta N. ***** 249 Data operazione 01/02/25");
    expect(prepared.name).not.toMatch(/Carta|Data|\*/i);
    expect(prepared.name.toLowerCase()).toContain("decathlon");
    expect(prepared.blocked).toBeNull();
  });

  it("tiene l'esercente dietro un intermediario di pagamento", () => {
    const prepared = prepareMerchantForModel("PAYPAL *GITHUB INC 4029357733 CA Carta N. ***** 249 Data operazione 01/02/25");
    expect(prepared.name.toLowerCase()).toContain("github");
    expect(prepared.blocked).toBeNull();
  });

  it("blocca un nome di persona", () => {
    expect(prepareMerchantForModel("Mario Rossi").blocked).toBe("persona");
    expect(prepareMerchantForModel("Rossi Mario Torino").blocked).toBe("persona");
  });

  it.each(["DB Vertrieb GmbH", "DB Vertrieb GmbH DE", "Mario Rossi S.r.l.", "Mario Rossi Ltd", "Mario Rossi Inc"])(
    "riconosce la forma societaria prima di ripulire %s",
    (description) => {
      const prepared = prepareMerchantForModel(description);
      expect(prepared.blocked).toBeNull();
      expect(prepared.name).not.toMatch(/gmbh|s\.r\.l|ltd|inc/i);
    }
  );

  it("ripulisce DB Vertrieb senza scambiarlo per una persona", () => {
    expect(prepareMerchantForModel("DB Vertrieb GmbH")).toEqual({ name: "Db Vertrieb", blocked: null });
  });

  it("non interpreta una parte del nome come forma societaria", () => {
    expect(prepareMerchantForModel("Mario Jacob").blocked).toBe("persona");
  });

  it("continua a bloccare i bonifici anche verso una società", () => {
    expect(prepareMerchantForModel("Bonifico a favore di DB Vertrieb GmbH").blocked).toBe("operazione");
  });

  it("non blocca i pagamenti con carta, anche con un nome da ditta individuale", () => {
    expect(prepareMerchantForModel("ROSSI MARIO TORINO IT Carta N. ***** 249 Data operazione 01/02/25").blocked).toBeNull();
  });

  it("non blocca un'attività con segni di attività", () => {
    expect(prepareMerchantForModel("Pizzeria Da Mario TORINO IT Carta N. ***** 249").blocked).toBeNull();
    expect(prepareMerchantForModel("BOFIPA SNC TORINO IT Carta N. ***** 249").blocked).toBeNull();
  });

  it.each(["PAYPAL *TICKETRAUS TIC", "Hostel World", "Pizza Teigmeister", "LS BURGER VISION TURMS", "Sönmez Baklava", "Azienda Napoletana Mobilità", "MUSEI NAZIONALI DEL VO", "LOVELY SOCIETA' COO"])(
    "recognizes a business without the Carta N. boilerplate: %s",
    (name) => expect(prepareMerchantForModel(name).blocked).toBeNull()
  );
  it.each(["PAYPAL *MARIO ROSSI", "De Florio Marianna", "GABRIELE STREE", "Vito a San Luca"])(
    "still protects ambiguous personal names: %s",
    (name) => expect(prepareMerchantForModel(name).blocked).toBe("persona")
  );
  it("does not use a brand to exempt a bank transfer", () => {
    expect(prepareMerchantForModel("Bonifico a favore di Ticketraus").blocked).toBe("operazione");
  });
  it("blocca trasferimenti e simili", () => {
    expect(prepareMerchantForModel("Bonifico a favore di Qualcuno").blocked).toBe("operazione");
    expect(prepareMerchantForModel("Versamento Contanti Atm").blocked).toBe("operazione");
  });
});
