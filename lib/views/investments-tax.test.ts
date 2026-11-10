import { describe, expect, it, vi } from "vitest";
import type { InvestmentData } from "@/lib/investments/data";
import { countryFeatures } from "@/lib/localization/config";

vi.mock("@/lib/investments/income-view", () => ({
  buildIncomeView: vi.fn(() => ({ instrumentsById: new Map(), taxSettings: new Map() })),
}));

const { buildIncomeView } = await import("@/lib/investments/income-view");
const { buildInvestmentsIncome } = await import("./investments-tax");

describe("buildInvestmentsIncome", () => {
  it("passes the country's tax mode to the web's income view (before tax outside Italy, #465)", () => {
    const data = { dismissedDividends: [] } as unknown as InvestmentData;
    const today = new Date("2026-10-21T12:00:00Z");
    buildInvestmentsIncome(data, today, { taxes: countryFeatures("OTHER").taxes });
    expect(buildIncomeView).toHaveBeenLastCalledWith(data, today, { taxes: false });
    buildInvestmentsIncome(data, today, { taxes: countryFeatures("IT").taxes });
    expect(buildIncomeView).toHaveBeenLastCalledWith(data, today, { taxes: true });
  });
});
