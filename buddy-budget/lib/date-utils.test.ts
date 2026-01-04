import {
  getDateRangeFromQuickRange,
  addDays,
  addMonths,
  addYears,
  startOfDay,
  endOfDay,
  startOfMonth,
  startOfYear,
  daysBetween,
  isToday,
  isPast,
  isFuture,
  type QuickDateRange,
} from "./date-utils";

describe("date-utils", () => {
  describe("getDateRangeFromQuickRange", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should calculate 1M range correctly", () => {
      const range = getDateRangeFromQuickRange("1M");

      expect(range.end.toISOString()).toBe(new Date("2024-06-15T12:00:00Z").toISOString());
      expect(range.start.getMonth()).toBe(4); // May (0-indexed)
      expect(range.start.getFullYear()).toBe(2024);
    });

    it("should calculate 3M range correctly", () => {
      const range = getDateRangeFromQuickRange("3M");

      expect(range.end.toISOString()).toBe(new Date("2024-06-15T12:00:00Z").toISOString());
      expect(range.start.getMonth()).toBe(2); // March (0-indexed)
      expect(range.start.getFullYear()).toBe(2024);
    });

    it("should calculate 6M range correctly", () => {
      const range = getDateRangeFromQuickRange("6M");

      expect(range.end.toISOString()).toBe(new Date("2024-06-15T12:00:00Z").toISOString());
      expect(range.start.getMonth()).toBe(11); // December (0-indexed)
      expect(range.start.getFullYear()).toBe(2023);
    });

    it("should calculate 1Y range correctly", () => {
      const range = getDateRangeFromQuickRange("1Y");

      expect(range.end.toISOString()).toBe(new Date("2024-06-15T12:00:00Z").toISOString());
      expect(range.start.getFullYear()).toBe(2023);
      expect(range.start.getMonth()).toBe(5); // June (0-indexed)
    });

    it("should calculate 2Y range correctly", () => {
      const range = getDateRangeFromQuickRange("2Y");

      expect(range.end.toISOString()).toBe(new Date("2024-06-15T12:00:00Z").toISOString());
      expect(range.start.getFullYear()).toBe(2022);
    });

    it("should calculate 5Y range correctly", () => {
      const range = getDateRangeFromQuickRange("5Y");

      expect(range.end.toISOString()).toBe(new Date("2024-06-15T12:00:00Z").toISOString());
      expect(range.start.getFullYear()).toBe(2019);
    });

    it("should calculate YTD range correctly", () => {
      const range = getDateRangeFromQuickRange("YTD");

      expect(range.end.toISOString()).toBe(new Date("2024-06-15T12:00:00Z").toISOString());
      expect(range.start.getMonth()).toBe(0); // January
      expect(range.start.getDate()).toBe(1);
      expect(range.start.getFullYear()).toBe(2024);
    });

    it("should calculate MAX range correctly", () => {
      const range = getDateRangeFromQuickRange("MAX");

      expect(range.end.toISOString()).toBe(new Date("2024-06-15T12:00:00Z").toISOString());
      expect(range.start.getFullYear()).toBe(2004); // 20 years ago
    });

    it("should handle all QuickDateRange types", () => {
      const ranges: QuickDateRange[] = [
        "1M",
        "3M",
        "6M",
        "1Y",
        "2Y",
        "5Y",
        "YTD",
        "MAX",
      ];

      ranges.forEach((range) => {
        const result = getDateRangeFromQuickRange(range);

        expect(result).toHaveProperty("start");
        expect(result).toHaveProperty("end");
        expect(result.start).toBeInstanceOf(Date);
        expect(result.end).toBeInstanceOf(Date);
        expect(result.start.getTime()).toBeLessThanOrEqual(
          result.end.getTime(),
        );
      });
    });
  });

  describe("addDays", () => {
    it("should add positive days", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = addDays(date, 5);

      expect(result.getDate()).toBe(20);
      expect(result.getMonth()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });

    it("should subtract days with negative number", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = addDays(date, -5);

      expect(result.getDate()).toBe(10);
      expect(result.getMonth()).toBe(0);
    });

    it("should handle month boundary", () => {
      const date = new Date("2024-01-30T00:00:00Z");
      const result = addDays(date, 5);

      expect(result.getDate()).toBe(4);
      expect(result.getMonth()).toBe(1); // February
    });

    it("should handle year boundary", () => {
      const date = new Date("2024-12-30T00:00:00Z");
      const result = addDays(date, 5);

      expect(result.getDate()).toBe(4);
      expect(result.getMonth()).toBe(0); // January
      expect(result.getFullYear()).toBe(2025);
    });

    it("should not mutate the original date", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const original = date.getTime();

      addDays(date, 5);
      expect(date.getTime()).toBe(original);
    });

    it("should handle zero days", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = addDays(date, 0);

      expect(result.getTime()).toBe(date.getTime());
    });
  });

  describe("addMonths", () => {
    it("should add positive months", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = addMonths(date, 3);

      expect(result.getMonth()).toBe(3); // April
      expect(result.getFullYear()).toBe(2024);
    });

    it("should subtract months with negative number", () => {
      const date = new Date("2024-04-15T00:00:00Z");
      const result = addMonths(date, -2);

      expect(result.getMonth()).toBe(1); // February
    });

    it("should handle year boundary", () => {
      const date = new Date("2024-11-15T00:00:00Z");
      const result = addMonths(date, 3);

      expect(result.getMonth()).toBe(1); // February
      expect(result.getFullYear()).toBe(2025);
    });

    it("should not mutate the original date", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const original = date.getTime();

      addMonths(date, 3);
      expect(date.getTime()).toBe(original);
    });

    it("should handle zero months", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = addMonths(date, 0);

      expect(result.getTime()).toBe(date.getTime());
    });
  });

  describe("addYears", () => {
    it("should add positive years", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = addYears(date, 2);

      expect(result.getFullYear()).toBe(2026);
    });

    it("should subtract years with negative number", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = addYears(date, -3);

      expect(result.getFullYear()).toBe(2021);
    });

    it("should not mutate the original date", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const original = date.getTime();

      addYears(date, 2);
      expect(date.getTime()).toBe(original);
    });

    it("should handle zero years", () => {
      const date = new Date("2024-01-15T00:00:00Z");
      const result = addYears(date, 0);

      expect(result.getTime()).toBe(date.getTime());
    });

    it("should handle leap years", () => {
      const date = new Date("2024-02-29T00:00:00Z"); // Leap year
      const result = addYears(date, 1);

      // JavaScript handles Feb 29 -> Feb 28 in non-leap years
      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(2); // March
      expect(result.getDate()).toBe(1);
    });
  });

  describe("startOfDay", () => {
    it("should set time to 00:00:00.000", () => {
      const date = new Date("2024-01-15T14:30:45.123Z");
      const result = startOfDay(date);

      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getDate()).toBe(15);
    });

    it("should not mutate the original date", () => {
      const date = new Date("2024-01-15T14:30:45.123Z");
      const original = date.getTime();

      startOfDay(date);
      expect(date.getTime()).toBe(original);
    });
  });

  describe("endOfDay", () => {
    it("should set time to 23:59:59.999", () => {
      const date = new Date("2024-01-15T14:30:45.123Z");
      const result = endOfDay(date);

      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(59);
      expect(result.getSeconds()).toBe(59);
      expect(result.getMilliseconds()).toBe(999);
      expect(result.getDate()).toBe(15);
    });

    it("should not mutate the original date", () => {
      const date = new Date("2024-01-15T14:30:45.123Z");
      const original = date.getTime();

      endOfDay(date);
      expect(date.getTime()).toBe(original);
    });
  });

  describe("startOfMonth", () => {
    it("should set to first day at 00:00:00.000", () => {
      const date = new Date("2024-01-15T14:30:45.123Z");
      const result = startOfMonth(date);

      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getMonth()).toBe(0); // January
    });

    it("should not mutate the original date", () => {
      const date = new Date("2024-01-15T14:30:45.123Z");
      const original = date.getTime();

      startOfMonth(date);
      expect(date.getTime()).toBe(original);
    });
  });

  describe("startOfYear", () => {
    it("should set to Jan 1 at 00:00:00.000", () => {
      const date = new Date("2024-06-15T14:30:45.123Z");
      const result = startOfYear(date);

      expect(result.getMonth()).toBe(0); // January
      expect(result.getDate()).toBe(1);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
      expect(result.getFullYear()).toBe(2024);
    });

    it("should not mutate the original date", () => {
      const date = new Date("2024-06-15T14:30:45.123Z");
      const original = date.getTime();

      startOfYear(date);
      expect(date.getTime()).toBe(original);
    });
  });

  describe("daysBetween", () => {
    it("should calculate positive difference", () => {
      const date1 = new Date("2024-01-01T00:00:00Z");
      const date2 = new Date("2024-01-11T00:00:00Z");
      const result = daysBetween(date1, date2);

      expect(result).toBe(10);
    });

    it("should calculate negative difference", () => {
      const date1 = new Date("2024-01-11T00:00:00Z");
      const date2 = new Date("2024-01-01T00:00:00Z");
      const result = daysBetween(date1, date2);

      expect(result).toBe(-10);
    });

    it("should return 0 for same date", () => {
      const date = new Date("2024-01-01T00:00:00Z");
      const result = daysBetween(date, date);

      expect(result).toBe(0);
    });

    it("should handle dates across months", () => {
      const date1 = new Date("2024-01-28T00:00:00Z");
      const date2 = new Date("2024-02-03T00:00:00Z");
      const result = daysBetween(date1, date2);

      expect(result).toBe(6);
    });

    it("should handle dates across years", () => {
      const date1 = new Date("2023-12-28T00:00:00Z");
      const date2 = new Date("2024-01-05T00:00:00Z");
      const result = daysBetween(date1, date2);

      expect(result).toBe(8);
    });
  });

  describe("isToday", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return true for today", () => {
      const date = new Date("2024-06-15T18:30:00Z");
      const result = isToday(date);

      expect(result).toBe(true);
    });

    it("should return false for yesterday", () => {
      const date = new Date("2024-06-14T12:00:00Z");
      const result = isToday(date);

      expect(result).toBe(false);
    });

    it("should return false for tomorrow", () => {
      const date = new Date("2024-06-16T12:00:00Z");
      const result = isToday(date);

      expect(result).toBe(false);
    });

    it("should ignore time component", () => {
      // Create dates for the same day as the mocked current time
      const date1 = new Date("2024-06-15T00:00:00");
      const date2 = new Date("2024-06-15T23:59:59");

      expect(isToday(date1)).toBe(true);
      expect(isToday(date2)).toBe(true);
    });
  });

  describe("isPast", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return true for past dates", () => {
      const date = new Date("2024-06-15T11:00:00Z");
      const result = isPast(date);

      expect(result).toBe(true);
    });

    it("should return false for future dates", () => {
      const date = new Date("2024-06-15T13:00:00Z");
      const result = isPast(date);

      expect(result).toBe(false);
    });

    it("should return false for exact current time", () => {
      const date = new Date("2024-06-15T12:00:00Z");
      const result = isPast(date);

      expect(result).toBe(false);
    });
  });

  describe("isFuture", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should return true for future dates", () => {
      const date = new Date("2024-06-15T13:00:00Z");
      const result = isFuture(date);

      expect(result).toBe(true);
    });

    it("should return false for past dates", () => {
      const date = new Date("2024-06-15T11:00:00Z");
      const result = isFuture(date);

      expect(result).toBe(false);
    });

    it("should return false for exact current time", () => {
      const date = new Date("2024-06-15T12:00:00Z");
      const result = isFuture(date);

      expect(result).toBe(false);
    });
  });
});
