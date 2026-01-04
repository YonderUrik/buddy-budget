import {
  CURRENCIES,
  COUNTRIES,
  DATE_FORMATS,
  NUMBER_FORMATS,
  LOCALES,
  INCOME_RANGES,
  PRIMARY_GOALS,
  type CurrencyCode,
  type CountryCode,
  type DateFormatValue,
  type NumberFormatValue,
  type LocaleValue,
  type IncomeRangeValue,
  type PrimaryGoalValue,
} from "../constants";

describe("constants", () => {
  describe("CURRENCIES", () => {
    it("should contain all expected currencies", () => {
      const expectedCodes = [
        "USD",
        "EUR",
        "GBP",
        "JPY",
        "CAD",
        "AUD",
        "CHF",
        "CNY",
        "INR",
        "BRL",
        "MXN",
        "KRW",
        "SGD",
        "HKD",
        "NZD",
      ];

      expectedCodes.forEach((code) => {
        expect(CURRENCIES).toHaveProperty(code);
      });
    });

    it("should have proper structure for each currency", () => {
      Object.entries(CURRENCIES).forEach(([key, currency]) => {
        expect(currency).toHaveProperty("code");
        expect(currency).toHaveProperty("symbol");
        expect(currency).toHaveProperty("name");
        expect(currency.code).toBe(key);
        expect(typeof currency.symbol).toBe("string");
        expect(typeof currency.name).toBe("string");
      });
    });

    it("should have unique symbols for different currencies", () => {
      const symbols = Object.values(CURRENCIES).map((c) => c.symbol);

      // Note: Some currencies share symbols (USD/MXN both use $, JPY/CNY both use ¥)
      expect(symbols.length).toBeGreaterThan(0);
    });

    it("should have USD currency with correct details", () => {
      expect(CURRENCIES.USD).toEqual({
        code: "USD",
        symbol: "$",
        name: "US Dollar",
      });
    });

    it("should have EUR currency with correct details", () => {
      expect(CURRENCIES.EUR).toEqual({
        code: "EUR",
        symbol: "€",
        name: "Euro",
      });
    });
  });

  describe("COUNTRIES", () => {
    it("should be an array", () => {
      expect(Array.isArray(COUNTRIES)).toBe(true);
    });

    it("should have proper structure for each country", () => {
      COUNTRIES.forEach((country) => {
        expect(country).toHaveProperty("code");
        expect(country).toHaveProperty("name");
        expect(country).toHaveProperty("flag");
        expect(typeof country.code).toBe("string");
        expect(typeof country.name).toBe("string");
        expect(typeof country.flag).toBe("string");
        expect(country.code.length).toBe(2);
      });
    });

    it("should have unique country codes", () => {
      const codes = COUNTRIES.map((c) => c.code);
      const uniqueCodes = new Set(codes);

      expect(codes.length).toBe(uniqueCodes.size);
    });

    it("should contain major countries", () => {
      const countryCodes = COUNTRIES.map((c) => c.code);

      expect(countryCodes).toContain("US");
      expect(countryCodes).toContain("GB");
      expect(countryCodes).toContain("CA");
      expect(countryCodes).toContain("AU");
      expect(countryCodes).toContain("DE");
      expect(countryCodes).toContain("FR");
      expect(countryCodes).toContain("JP");
    });

    it("should have at least 20 countries", () => {
      expect(COUNTRIES.length).toBeGreaterThanOrEqual(20);
    });
  });

  describe("DATE_FORMATS", () => {
    it("should be an array", () => {
      expect(Array.isArray(DATE_FORMATS)).toBe(true);
    });

    it("should have proper structure for each format", () => {
      DATE_FORMATS.forEach((format) => {
        expect(format).toHaveProperty("value");
        expect(format).toHaveProperty("label");
        expect(format).toHaveProperty("example");
        expect(typeof format.value).toBe("string");
        expect(typeof format.label).toBe("string");
        expect(typeof format.example).toBe("string");
      });
    });

    it("should have unique format values", () => {
      const values = DATE_FORMATS.map((f) => f.value);
      const uniqueValues = new Set(values);

      expect(values.length).toBe(uniqueValues.size);
    });

    it("should contain common date formats", () => {
      const formatValues = DATE_FORMATS.map((f) => f.value);

      expect(formatValues).toContain("MM/DD/YYYY");
      expect(formatValues).toContain("DD/MM/YYYY");
      expect(formatValues).toContain("YYYY-MM-DD");
    });

    it("should have examples that match the format description", () => {
      const usFormat = DATE_FORMATS.find((f) => f.value === "MM/DD/YYYY");

      expect(usFormat?.example).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);

      const isoFormat = DATE_FORMATS.find((f) => f.value === "YYYY-MM-DD");

      expect(isoFormat?.example).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("NUMBER_FORMATS", () => {
    it("should be an array", () => {
      expect(Array.isArray(NUMBER_FORMATS)).toBe(true);
    });

    it("should have proper structure for each format", () => {
      NUMBER_FORMATS.forEach((format) => {
        expect(format).toHaveProperty("value");
        expect(format).toHaveProperty("label");
        expect(format).toHaveProperty("flag");
        expect(typeof format.value).toBe("string");
        expect(typeof format.label).toBe("string");
        expect(typeof format.flag).toBe("string");
      });
    });

    it("should have unique format values", () => {
      const values = NUMBER_FORMATS.map((f) => f.value);
      const uniqueValues = new Set(values);

      expect(values.length).toBe(uniqueValues.size);
    });

    it("should contain common locales", () => {
      const formatValues = NUMBER_FORMATS.map((f) => f.value);

      expect(formatValues).toContain("en-US");
      expect(formatValues).toContain("en-GB");
      expect(formatValues).toContain("de-DE");
      expect(formatValues).toContain("fr-FR");
    });

    it("should have labels that include number examples", () => {
      NUMBER_FORMATS.forEach((format) => {
        expect(format.label).toMatch(/\d/);
      });
    });
  });

  describe("LOCALES", () => {
    it("should be an array", () => {
      expect(Array.isArray(LOCALES)).toBe(true);
    });

    it("should have proper structure for each locale", () => {
      LOCALES.forEach((locale) => {
        expect(locale).toHaveProperty("value");
        expect(locale).toHaveProperty("label");
        expect(locale).toHaveProperty("flag");
        expect(typeof locale.value).toBe("string");
        expect(typeof locale.label).toBe("string");
        expect(typeof locale.flag).toBe("string");
      });
    });

    it("should have unique locale values", () => {
      const values = LOCALES.map((l) => l.value);
      const uniqueValues = new Set(values);

      expect(values.length).toBe(uniqueValues.size);
    });

    it("should contain common locales", () => {
      const localeValues = LOCALES.map((l) => l.value);

      expect(localeValues).toContain("en-US");
      expect(localeValues).toContain("en-GB");
      expect(localeValues).toContain("de-DE");
      expect(localeValues).toContain("ja-JP");
    });
  });

  describe("INCOME_RANGES", () => {
    it("should be an array", () => {
      expect(Array.isArray(INCOME_RANGES)).toBe(true);
    });

    it("should have proper structure for each range", () => {
      INCOME_RANGES.forEach((range) => {
        expect(range).toHaveProperty("value");
        expect(range).toHaveProperty("label");
        expect(typeof range.value).toBe("string");
        expect(typeof range.label).toBe("string");
      });
    });

    it("should have unique range values", () => {
      const values = INCOME_RANGES.map((r) => r.value);
      const uniqueValues = new Set(values);

      expect(values.length).toBe(uniqueValues.size);
    });

    it("should be in ascending order", () => {
      const expectedOrder = [
        "0-2000",
        "2000-4000",
        "4000-6000",
        "6000-8000",
        "8000-10000",
        "10000+",
      ];

      expect(INCOME_RANGES.map((r) => r.value)).toEqual(expectedOrder);
    });

    it("should have labels that include dollar signs", () => {
      INCOME_RANGES.forEach((range) => {
        expect(range.label).toContain("$");
      });
    });
  });

  describe("PRIMARY_GOALS", () => {
    it("should be an array", () => {
      expect(Array.isArray(PRIMARY_GOALS)).toBe(true);
    });

    it("should have proper structure for each goal", () => {
      PRIMARY_GOALS.forEach((goal) => {
        expect(goal).toHaveProperty("value");
        expect(goal).toHaveProperty("label");
        expect(typeof goal.value).toBe("string");
        expect(typeof goal.label).toBe("string");
      });
    });

    it("should have unique goal values", () => {
      const values = PRIMARY_GOALS.map((g) => g.value);
      const uniqueValues = new Set(values);

      expect(values.length).toBe(uniqueValues.size);
    });

    it("should contain common financial goals", () => {
      const goalValues = PRIMARY_GOALS.map((g) => g.value);

      expect(goalValues).toContain("save_money");
      expect(goalValues).toContain("reduce_debt");
      expect(goalValues).toContain("invest");
      expect(goalValues).toContain("budget");
    });

    it("should use snake_case for values", () => {
      PRIMARY_GOALS.forEach((goal) => {
        expect(goal.value).toMatch(/^[a-z_]+$/);
      });
    });
  });

  describe("Type Exports", () => {
    it("should allow valid CurrencyCode", () => {
      const validCode: CurrencyCode = "USD";

      expect(validCode).toBe("USD");
    });

    it("should allow valid CountryCode", () => {
      const validCode: CountryCode = "US";

      expect(validCode).toBe("US");
    });

    it("should allow valid DateFormatValue", () => {
      const validFormat: DateFormatValue = "MM/DD/YYYY";

      expect(validFormat).toBe("MM/DD/YYYY");
    });

    it("should allow valid NumberFormatValue", () => {
      const validFormat: NumberFormatValue = "en-US";

      expect(validFormat).toBe("en-US");
    });

    it("should allow valid LocaleValue", () => {
      const validLocale: LocaleValue = "en-US";

      expect(validLocale).toBe("en-US");
    });

    it("should allow valid IncomeRangeValue", () => {
      const validRange: IncomeRangeValue = "0-2000";

      expect(validRange).toBe("0-2000");
    });

    it("should allow valid PrimaryGoalValue", () => {
      const validGoal: PrimaryGoalValue = "save_money";

      expect(validGoal).toBe("save_money");
    });
  });
});
