import {
  getDefaultLocale,
  formatCurrency,
  formatNumber,
  formatPercentage,
  getCurrencySymbol,
  formatWithUnit,
  formatDate,
  formatDateRange,
  formatDateShort,
  formatDateWithYear,
  formatDateMonthYear,
  formatDateByInterval,
  abbreviateNumber,
  formatLargeNumber,
  formatCurrencyWithLocale,
  formatChangeWithLocale,
  formatPercentWithLocale,
  formatDateByPattern,
  COMMON_CURRENCIES,
} from './format';

describe('format utilities', () => {
  describe('getDefaultLocale', () => {
    it('should always return en-US for consistency', () => {
      expect(getDefaultLocale()).toBe('en-US');
    });
  });

  describe('formatCurrency', () => {
    it('should format basic currency with default USD', () => {
      const result = formatCurrency(1000);
      expect(result).toBe('$1,000');
    });

    it('should format currency with custom currency code', () => {
      const result = formatCurrency(1000, { currency: 'EUR' });
      expect(result).toContain('1,000');
    });

    it('should format currency with decimals option', () => {
      const result = formatCurrency(1234.56, { decimals: 2 });
      expect(result).toContain('1,234.56');
    });

    it('should format currency with showCents option', () => {
      const result = formatCurrency(42, { showCents: true });
      expect(result).toContain('42.00');
    });

    it('should format currency with compact notation', () => {
      const result = formatCurrency(1500000, { notation: 'compact' });
      expect(result).toMatch(/[12](\.\d)?M/); // Could be $1.5M or $2M depending on rounding
    });

    it('should handle zero amount', () => {
      const result = formatCurrency(0);
      expect(result).toContain('0');
    });

    it('should handle negative amounts', () => {
      const result = formatCurrency(-500);
      expect(result).toContain('500');
      expect(result).toMatch(/[-()]/); // Should have negative sign or parentheses
    });

    it('should format with custom locale', () => {
      const result = formatCurrency(1000, { currency: 'EUR', locale: 'de-DE' });
      expect(result).toContain('1');
    });

    it('should prioritize decimals option over showCents', () => {
      const result = formatCurrency(42, { decimals: 3, showCents: true });
      expect(result).toContain('42.000');
    });

    it('should handle large numbers', () => {
      const result = formatCurrency(9999999.99);
      expect(result).toMatch(/10,000,000|9,999,999/); // Could round up to 10M
    });
  });

  describe('formatNumber', () => {
    it('should format number with default 2 decimals', () => {
      const result = formatNumber(1234.56);
      expect(result).toBe('1,234.56');
    });

    it('should format number with custom decimals', () => {
      const result = formatNumber(1234.5678, { decimals: 0 });
      expect(result).toBe('1,235');
    });

    it('should format number with compact notation', () => {
      const result = formatNumber(1234.56, { notation: 'compact' });
      expect(result).toMatch(/1\.\d{1,2}K/); // Could be 1.2K or 1.23K
    });

    it('should format number without grouping', () => {
      const result = formatNumber(1234.56, { useGrouping: false });
      expect(result).toBe('1234.56');
    });

    it('should handle negative numbers', () => {
      const result = formatNumber(-1234.56);
      expect(result).toBe('-1,234.56');
    });

    it('should handle zero', () => {
      const result = formatNumber(0);
      expect(result).toBe('0.00');
    });

    it('should handle very large numbers', () => {
      const result = formatNumber(9876543210.12);
      expect(result).toContain('9,876,543,210.12');
    });

    it('should format with custom locale', () => {
      const result = formatNumber(1234.56, { locale: 'de-DE' });
      expect(result).toMatch(/1[\.,]\d/);
    });
  });

  describe('formatPercentage', () => {
    it('should format decimal as percentage with default 1 decimal', () => {
      const result = formatPercentage(0.075);
      expect(result).toMatch(/7.5%|7,5%/);
    });

    it('should format with custom decimals', () => {
      const result = formatPercentage(0.075, { decimals: 2 });
      expect(result).toMatch(/7.50%|7,50%/);
    });

    it('should handle multiply option', () => {
      const result = formatPercentage(75, { multiply: true, decimals: 0 });
      expect(result).toBe('75%');
    });

    it('should handle zero percentage', () => {
      const result = formatPercentage(0);
      expect(result).toMatch(/0.0%|0,0%/);
    });

    it('should handle negative percentages', () => {
      const result = formatPercentage(-0.05);
      expect(result).toContain('-');
      expect(result).toContain('5');
    });

    it('should format with custom locale', () => {
      const result = formatPercentage(0.075, { locale: 'de-DE' });
      expect(result).toMatch(/%/);
    });
  });

  describe('getCurrencySymbol', () => {
    it('should get USD symbol', () => {
      const result = getCurrencySymbol('USD');
      expect(result).toBe('$');
    });

    it('should get EUR symbol', () => {
      const result = getCurrencySymbol('EUR');
      expect(result).toBe('€');
    });

    it('should get GBP symbol', () => {
      const result = getCurrencySymbol('GBP');
      expect(result).toBe('£');
    });

    it('should get JPY symbol', () => {
      const result = getCurrencySymbol('JPY');
      expect(result).toBe('¥');
    });

    it('should work with custom locale', () => {
      const result = getCurrencySymbol('USD', 'de-DE');
      expect(result).toBe('$');
    });
  });

  describe('formatWithUnit', () => {
    it('should format number with unit suffix', () => {
      const result = formatWithUnit(5, 'years');
      expect(result).toBe('5 years');
    });

    it('should format with decimals', () => {
      const result = formatWithUnit(10.5, 'kg', { decimals: 1 });
      expect(result).toBe('10.5 kg');
    });

    it('should handle zero', () => {
      const result = formatWithUnit(0, 'items');
      expect(result).toBe('0 items');
    });

    it('should work with custom locale', () => {
      const result = formatWithUnit(1000, 'meters', { locale: 'de-DE' });
      expect(result).toContain('meters');
    });
  });

  describe('formatDate', () => {
    const testDate = new Date('2024-01-15T12:00:00Z');

    it('should format date with default medium style', () => {
      const result = formatDate(testDate);
      expect(result).toContain('2024');
      expect(result).toContain('Jan');
    });

    it('should format date with custom locale', () => {
      const result = formatDate(testDate, 'de-DE');
      expect(result).toBeTruthy();
    });

    it('should format date with custom dateStyle', () => {
      const result = formatDate(testDate, null, { dateStyle: 'short' });
      expect(result).toBeTruthy();
    });

    it('should return empty string for null date', () => {
      const result = formatDate(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined date', () => {
      const result = formatDate(undefined);
      expect(result).toBe('');
    });

    it('should handle invalid date gracefully', () => {
      const result = formatDate('invalid');
      expect(result).toBe('');
    });

    it('should accept string dates', () => {
      const result = formatDate('2024-01-15');
      expect(result).toBeTruthy();
    });
  });

  describe('formatDateRange', () => {
    it('should format date range', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const result = formatDateRange(start, end);
      expect(result).toContain('2024');
    });

    it('should format with custom locale', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const result = formatDateRange(start, end, { locale: 'de-DE' });
      expect(result).toBeTruthy();
    });

    it('should format with custom dateStyle', () => {
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');
      const result = formatDateRange(start, end, { dateStyle: 'short' });
      expect(result).toBeTruthy();
    });
  });

  describe('formatDateShort', () => {
    it('should format date as short month and day', () => {
      const result = formatDateShort(new Date('2024-01-15'));
      expect(result).toMatch(/Jan\s+15|15\s+Jan/);
    });

    it('should return empty string for null', () => {
      const result = formatDateShort(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined', () => {
      const result = formatDateShort(undefined);
      expect(result).toBe('');
    });

    it('should handle invalid date', () => {
      const result = formatDateShort('invalid');
      expect(result).toMatch(/Invalid Date|^$/);
    });

    it('should work with custom locale', () => {
      const result = formatDateShort(new Date('2024-01-15'), 'de-DE');
      expect(result).toBeTruthy();
    });

    it('should handle toLocaleDateString errors gracefully', () => {
      // Mock Date.prototype.toLocaleDateString to throw
      const original = Date.prototype.toLocaleDateString;
      Date.prototype.toLocaleDateString = function() {
        throw new Error('toLocaleDateString error');
      };

      const result = formatDateShort(new Date('2024-01-15'));
      expect(result).toBe('');

      // Restore
      Date.prototype.toLocaleDateString = original;
    });
  });

  describe('formatDateWithYear', () => {
    it('should format date with month, day, and year', () => {
      const result = formatDateWithYear(new Date('2024-01-15'));
      expect(result).toContain('2024');
      expect(result).toMatch(/Jan|15/);
    });

    it('should return empty string for null', () => {
      const result = formatDateWithYear(null);
      expect(result).toBe('');
    });

    it('should handle invalid date', () => {
      const result = formatDateWithYear('invalid');
      expect(result).toMatch(/Invalid Date|^$/);
    });

    it('should work with custom locale', () => {
      const result = formatDateWithYear(new Date('2024-01-15'), 'de-DE');
      expect(result).toBeTruthy();
    });

    it('should handle toLocaleDateString errors gracefully', () => {
      // Mock Date.prototype.toLocaleDateString to throw
      const original = Date.prototype.toLocaleDateString;
      Date.prototype.toLocaleDateString = function() {
        throw new Error('toLocaleDateString error');
      };

      const result = formatDateWithYear(new Date('2024-01-15'));
      expect(result).toBe('');

      // Restore
      Date.prototype.toLocaleDateString = original;
    });
  });

  describe('formatDateMonthYear', () => {
    it('should format date as month and year', () => {
      const result = formatDateMonthYear(new Date('2024-01-15'));
      expect(result).toMatch(/Jan.*2024|2024.*Jan/);
    });

    it('should return empty string for null', () => {
      const result = formatDateMonthYear(null);
      expect(result).toBe('');
    });

    it('should handle invalid date', () => {
      const result = formatDateMonthYear('invalid');
      expect(result).toMatch(/Invalid Date|^$/);
    });

    it('should work with custom locale', () => {
      const result = formatDateMonthYear(new Date('2024-01-15'), 'de-DE');
      expect(result).toBeTruthy();
    });

    it('should handle toLocaleDateString errors gracefully', () => {
      // Mock Date.prototype.toLocaleDateString to throw
      const original = Date.prototype.toLocaleDateString;
      Date.prototype.toLocaleDateString = function() {
        throw new Error('toLocaleDateString error');
      };

      const result = formatDateMonthYear(new Date('2024-01-15'));
      expect(result).toBe('');

      // Restore
      Date.prototype.toLocaleDateString = original;
    });
  });

  describe('formatDateByInterval', () => {
    const testDate = new Date('2024-01-15');

    it('should format with short format for 1d interval', () => {
      const result = formatDateByInterval(testDate, '1d');
      expect(result).toMatch(/Jan\s+15|15\s+Jan/);
    });

    it('should format with short format for 1wk interval', () => {
      const result = formatDateByInterval(testDate, '1wk');
      expect(result).toMatch(/Jan\s+15|15\s+Jan/);
    });

    it('should format with month-year format for 1mo interval', () => {
      const result = formatDateByInterval(testDate, '1mo');
      expect(result).toMatch(/Jan.*2024|2024.*Jan/);
    });

    it('should return empty string for null date', () => {
      const result = formatDateByInterval(null, '1d');
      expect(result).toBe('');
    });

    it('should work with custom locale', () => {
      const result = formatDateByInterval(testDate, '1d', 'de-DE');
      expect(result).toBeTruthy();
    });
  });

  describe('abbreviateNumber', () => {
    it('should return "0" for zero', () => {
      expect(abbreviateNumber(0)).toBe('0');
    });

    it('should not abbreviate small numbers', () => {
      expect(abbreviateNumber(999)).toBe('999');
    });

    it('should abbreviate thousands', () => {
      expect(abbreviateNumber(1500)).toBe('1.5K');
    });

    it('should abbreviate millions', () => {
      expect(abbreviateNumber(1500000)).toBe('1.5M');
    });

    it('should abbreviate billions', () => {
      expect(abbreviateNumber(1500000000)).toBe('1.5B');
    });

    it('should abbreviate trillions', () => {
      expect(abbreviateNumber(1500000000000)).toBe('1.5T');
    });

    it('should handle custom decimal places', () => {
      expect(abbreviateNumber(1234, 2)).toBe('1.23K');
    });

    it('should handle negative numbers', () => {
      const result = abbreviateNumber(-1500);
      expect(result).toBe('-1.5K');
    });

    it('should handle numbers close to boundaries', () => {
      expect(abbreviateNumber(999999)).toContain('K');
      expect(abbreviateNumber(1000000)).toContain('M');
    });
  });

  describe('formatLargeNumber', () => {
    it('should format trillions', () => {
      const result = formatLargeNumber(1.5e12, 'USD');
      expect(result).toContain('T');
    });

    it('should format billions', () => {
      const result = formatLargeNumber(1.5e9, 'USD');
      expect(result).toContain('B');
    });

    it('should format millions', () => {
      const result = formatLargeNumber(1.5e6, 'USD');
      expect(result).toContain('M');
    });

    it('should format smaller numbers normally', () => {
      const result = formatLargeNumber(1000, 'USD');
      expect(result).toContain('$');
      expect(result).toContain('1,000');
    });

    it('should work with different currencies', () => {
      const result = formatLargeNumber(1.5e9, 'EUR');
      expect(result).toContain('B');
    });
  });

  describe('formatCurrencyWithLocale', () => {
    it('should format with US locale and USD', () => {
      const result = formatCurrencyWithLocale(2325.25, 'USD', 'en-US');
      expect(result).toBe('$2,325.25');
    });

    it('should format with German locale and EUR', () => {
      const result = formatCurrencyWithLocale(2325.25, 'EUR', 'de-DE');
      expect(result).toContain('2.325,25');
    });

    it('should default to USD and en-US', () => {
      const result = formatCurrencyWithLocale(1000);
      expect(result).toBe('$1,000.00');
    });

    it('should throw on invalid currency code', () => {
      // Invalid currency codes throw RangeError
      expect(() => formatCurrencyWithLocale(1000, 'INVALID', 'en-US')).toThrow();
    });

    it('should handle negative amounts', () => {
      const result = formatCurrencyWithLocale(-500, 'USD', 'en-US');
      expect(result).toContain('500');
    });
  });

  describe('formatChangeWithLocale', () => {
    it('should format positive change with + sign', () => {
      const result = formatChangeWithLocale(78.9, 'USD', 'en-US');
      expect(result).toContain('+');
      expect(result).toContain('78.90');
    });

    it('should format negative change with - sign', () => {
      const result = formatChangeWithLocale(-50, 'USD', 'en-US');
      expect(result).toContain('-');
      expect(result).toContain('50.00');
    });

    it('should format zero with + sign', () => {
      const result = formatChangeWithLocale(0, 'USD', 'en-US');
      expect(result).toContain('+');
    });

    it('should work with EUR and de-DE locale', () => {
      const result = formatChangeWithLocale(78.9, 'EUR', 'de-DE');
      expect(result).toContain('+');
    });

    it('should default to USD and en-US', () => {
      const result = formatChangeWithLocale(100);
      expect(result).toContain('+');
      expect(result).toContain('100.00');
    });

    it('should throw on invalid currency code', () => {
      // Invalid currency codes throw RangeError
      expect(() => formatChangeWithLocale(100, 'INVALID', 'en-US')).toThrow();
    });

    it('should fall back to manual formatting on Intl.NumberFormat error', () => {
      // Save original
      const originalNumberFormat = Intl.NumberFormat;

      // Mock to throw error
      Intl.NumberFormat = function() {
        throw new Error('NumberFormat error');
      };

      const result = formatChangeWithLocale(78.9, 'USD', 'en-US');
      expect(result).toContain('+');
      expect(result).toContain('78.90');

      // Test negative - fallback uses sign prefix
      const negResult = formatChangeWithLocale(-50, 'USD', 'en-US');
      expect(negResult).toContain('$');
      expect(negResult).toContain('50.00');

      // Restore
      Intl.NumberFormat = originalNumberFormat;
    });
  });

  describe('formatPercentWithLocale', () => {
    it('should format positive percent with + sign', () => {
      const result = formatPercentWithLocale(0.0639, 'en-US');
      expect(result).toContain('+');
      expect(result).toContain('6.39');
    });

    it('should format negative percent with - sign', () => {
      const result = formatPercentWithLocale(-0.05, 'en-US');
      expect(result).toContain('-');
      expect(result).toContain('5.00');
    });

    it('should format zero with + sign', () => {
      const result = formatPercentWithLocale(0, 'en-US');
      expect(result).toContain('+');
    });

    it('should work with de-DE locale', () => {
      const result = formatPercentWithLocale(0.0639, 'de-DE');
      expect(result).toContain('+');
    });

    it('should default to en-US locale', () => {
      const result = formatPercentWithLocale(0.1);
      expect(result).toContain('+');
      expect(result).toContain('10.00');
    });

    it('should handle invalid locale gracefully', () => {
      const result = formatPercentWithLocale(0.1, 'invalid-locale');
      expect(result).toBeTruthy();
    });

    it('should fall back to manual formatting on Intl.NumberFormat error', () => {
      // Save original Intl.NumberFormat
      const originalNumberFormat = Intl.NumberFormat;

      // Mock Intl.NumberFormat to throw an error
      Intl.NumberFormat = function() {
        throw new Error('NumberFormat error');
      };

      const result = formatPercentWithLocale(0.0639, 'en-US');
      expect(result).toContain('+');
      expect(result).toContain('6.39');
      expect(result).toContain('%');

      // Restore original
      Intl.NumberFormat = originalNumberFormat;
    });
  });

  describe('formatDateByPattern', () => {
    const testDate = new Date(2024, 9, 23); // October 23, 2024

    it('should format as MM/DD/YYYY', () => {
      const result = formatDateByPattern(testDate, 'MM/DD/YYYY');
      expect(result).toBe('10/23/2024');
    });

    it('should format as DD/MM/YYYY', () => {
      const result = formatDateByPattern(testDate, 'DD/MM/YYYY');
      expect(result).toBe('23/10/2024');
    });

    it('should format as YYYY-MM-DD', () => {
      const result = formatDateByPattern(testDate, 'YYYY-MM-DD');
      expect(result).toBe('2024-10-23');
    });

    it('should format as DD.MM.YYYY', () => {
      const result = formatDateByPattern(testDate, 'DD.MM.YYYY');
      expect(result).toBe('23.10.2024');
    });

    it('should default to MM/DD/YYYY', () => {
      const result = formatDateByPattern(testDate);
      expect(result).toBe('10/23/2024');
    });

    it('should default to MM/DD/YYYY for unknown format', () => {
      const result = formatDateByPattern(testDate, 'UNKNOWN');
      expect(result).toBe('10/23/2024');
    });

    it('should return empty string for null date', () => {
      const result = formatDateByPattern(null);
      expect(result).toBe('');
    });

    it('should return empty string for undefined date', () => {
      const result = formatDateByPattern(undefined);
      expect(result).toBe('');
    });

    it('should handle invalid date', () => {
      const result = formatDateByPattern('invalid');
      expect(result).toMatch(/NaN|^$/);
    });

    it('should pad single digit months and days', () => {
      const singleDigitDate = new Date(2024, 0, 5); // January 5, 2024
      const result = formatDateByPattern(singleDigitDate, 'MM/DD/YYYY');
      expect(result).toBe('01/05/2024');
    });

    it('should accept string dates', () => {
      const result = formatDateByPattern('2024-10-23', 'YYYY-MM-DD');
      expect(result).toBe('2024-10-23');
    });

    it('should handle date errors gracefully', () => {
      // Mock Date methods to throw
      const originalGetMonth = Date.prototype.getMonth;
      Date.prototype.getMonth = function() {
        throw new Error('getMonth error');
      };

      const result = formatDateByPattern(new Date('2024-01-15'));
      expect(result).toBe('');

      // Restore
      Date.prototype.getMonth = originalGetMonth;
    });
  });

  describe('COMMON_CURRENCIES', () => {
    it('should export COMMON_CURRENCIES constant', () => {
      expect(COMMON_CURRENCIES).toBeDefined();
      expect(typeof COMMON_CURRENCIES).toBe('object');
    });

    it('should contain USD', () => {
      expect(COMMON_CURRENCIES).toHaveProperty('USD');
    });
  });

  describe('default export', () => {
    it('should export all functions in default object', async () => {
      const defaultExport = (await import('./format')).default;
      expect(defaultExport).toHaveProperty('formatCurrency');
      expect(defaultExport).toHaveProperty('formatNumber');
      expect(defaultExport).toHaveProperty('formatPercentage');
      expect(defaultExport).toHaveProperty('getCurrencySymbol');
      expect(defaultExport).toHaveProperty('formatWithUnit');
      expect(defaultExport).toHaveProperty('formatDate');
      expect(defaultExport).toHaveProperty('formatDateRange');
      expect(defaultExport).toHaveProperty('formatDateShort');
      expect(defaultExport).toHaveProperty('formatDateWithYear');
      expect(defaultExport).toHaveProperty('formatDateMonthYear');
      expect(defaultExport).toHaveProperty('formatDateByInterval');
      expect(defaultExport).toHaveProperty('abbreviateNumber');
      expect(defaultExport).toHaveProperty('getDefaultLocale');
      expect(defaultExport).toHaveProperty('formatLargeNumber');
      expect(defaultExport).toHaveProperty('formatCurrencyWithLocale');
      expect(defaultExport).toHaveProperty('formatChangeWithLocale');
      expect(defaultExport).toHaveProperty('formatPercentWithLocale');
      expect(defaultExport).toHaveProperty('formatDateByPattern');
    });
  });
});
