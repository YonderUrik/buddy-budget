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
    expect(prepareMerchantForModel("ROSSI MARIO TORINO IT Carta N. ***** 249 Data operazione 01/02/25").blocked).toBe("persona");
  });

  it("non blocca un'attività con segni di attività", () => {
    expect(prepareMerchantForModel("Pizzeria Da Mario TORINO IT Carta N. ***** 249").blocked).toBeNull();
    expect(prepareMerchantForModel("BOFIPA SNC TORINO IT Carta N. ***** 249").blocked).toBeNull();
  });

  it("blocca trasferimenti e simili", () => {
    expect(prepareMerchantForModel("Bonifico a favore di Qualcuno").blocked).toBe("operazione");
    expect(prepareMerchantForModel("Versamento Contanti Atm").blocked).toBe("operazione");
  });
});
