/**
 * Comprehensive formatting utilities for currency, numbers, and percentages
 * Supports multiple currencies, locales, and formatting options
 */

import { CURRENCIES } from './constants';

/**
 * Get the user's browser locale or fallback to en-US
 * @returns {string} Locale string (e.g., 'en-US', 'de-DE')
 */
export function getDefaultLocale() {
  // Always use en-US to ensure consistent formatting between server and client
  // This prevents hydration mismatches in SSR applications
  return 'en-US';
}

/**
 * Format a number as currency with customizable options
 *
 * @param {number} amount - The amount to format
 * @param {Object} options - Formatting options
 * @param {string} [options.currency='USD'] - Currency code (USD, EUR, GBP, JPY, etc.)
 * @param {string} [options.locale] - Locale for formatting (defaults to browser locale)
 * @param {number} [options.decimals] - Number of decimal places (default: 0 for whole currencies, 2 otherwise)
 * @param {string} [options.notation] - 'standard' or 'compact' (e.g., $1.5M)
 * @param {boolean} [options.showCents=false] - Force showing cents even for whole numbers
 *
 * @returns {string} Formatted currency string
 *
 * @example
 * formatCurrency(1000) // "$1,000"
 * formatCurrency(1000, { currency: 'EUR', locale: 'de-DE' }) // "1.000 €"
 * formatCurrency(1500000, { notation: 'compact' }) // "$1.5M"
 * formatCurrency(42.5, { showCents: true }) // "$42.50"
 */
export function formatCurrency(amount, options = {}) {
  const {
    currency = 'USD',
    locale = getDefaultLocale(),
    decimals,
    notation = 'standard',
    showCents = false
  } = options;

  // Determine decimal places
  let minimumFractionDigits;
  let maximumFractionDigits;

  if (decimals !== undefined) {
    minimumFractionDigits = decimals;
    maximumFractionDigits = decimals;
  } else if (showCents) {
    minimumFractionDigits = 2;
    maximumFractionDigits = 2;
  } else {
    minimumFractionDigits = 0;
    maximumFractionDigits = 0;
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
    notation
  }).format(amount);
}

/**
 * Format a number with customizable options
 *
 * @param {number} value - The number to format
 * @param {Object} options - Formatting options
 * @param {string} [options.locale] - Locale for formatting (defaults to browser locale)
 * @param {number} [options.decimals=2] - Number of decimal places
 * @param {string} [options.notation='standard'] - 'standard' or 'compact'
 * @param {string} [options.style='decimal'] - 'decimal', 'percent', or 'unit'
 * @param {boolean} [options.useGrouping=true] - Whether to use thousand separators
 *
 * @returns {string} Formatted number string
 *
 * @example
 * formatNumber(1234.56) // "1,234.56"
 * formatNumber(1234.56, { decimals: 0 }) // "1,235"
 * formatNumber(1234.56, { notation: 'compact' }) // "1.2K"
 * formatNumber(1234.56, { useGrouping: false }) // "1234.56"
 */
export function formatNumber(value, options = {}) {
  const {
    locale = getDefaultLocale(),
    decimals = 2,
    notation = 'standard',
    style = 'decimal',
    useGrouping = true
  } = options;

  return new Intl.NumberFormat(locale, {
    style,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    notation,
    useGrouping
  }).format(value);
}

/**
 * Format a number as a percentage
 *
 * @param {number} value - The value to format (0.075 for 7.5%)
 * @param {Object} options - Formatting options
 * @param {string} [options.locale] - Locale for formatting (defaults to browser locale)
 * @param {number} [options.decimals=1] - Number of decimal places
 * @param {boolean} [options.multiply=false] - If true, treats input as already percentage (75 instead of 0.75)
 *
 * @returns {string} Formatted percentage string
 *
 * @example
 * formatPercentage(0.075) // "7.5%"
 * formatPercentage(0.075, { decimals: 2 }) // "7.50%"
 * formatPercentage(75, { multiply: true, decimals: 0 }) // "75%"
 */
export function formatPercentage(value, options = {}) {
  const {
    locale = getDefaultLocale(),
    decimals = 1,
    multiply = false
  } = options;

  const adjustedValue = multiply ? value / 100 : value;

  return new Intl.NumberFormat(locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(adjustedValue);
}

/**
 * Get the currency symbol for a given currency code
 *
 * @param {string} currency - Currency code (USD, EUR, GBP, etc.)
 * @param {string} [locale] - Locale for formatting (defaults to browser locale)
 *
 * @returns {string} Currency symbol
 *
 * @example
 * getCurrencySymbol('USD') // "$"
 * getCurrencySymbol('EUR') // "€"
 * getCurrencySymbol('GBP') // "£"
 * getCurrencySymbol('JPY') // "¥"
 */
export function getCurrencySymbol(currency, locale = getDefaultLocale()) {
  return (0)
    .toLocaleString(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    })
    .replace(/\d/g, '')
    .trim();
}

/**
 * Format a number with custom suffix (e.g., "5 years", "10 items")
 *
 * @param {number} value - The number to format
 * @param {string} unit - The unit suffix
 * @param {Object} options - Formatting options
 * @param {string} [options.locale] - Locale for formatting
 * @param {number} [options.decimals=0] - Number of decimal places
 *
 * @returns {string} Formatted number with suffix
 *
 * @example
 * formatWithUnit(5, 'years') // "5 years"
 * formatWithUnit(10.5, 'kg', { decimals: 1 }) // "10.5 kg"
 */
export function formatWithUnit(value, unit, options = {}) {
  const {
    locale = getDefaultLocale(),
    decimals = 0
  } = options;

  const formattedNumber = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value);

  return `${formattedNumber} ${unit}`;
}

/**
 * Format a date as a readable string
 *
 * @param {Date} date - The date to format
 * @param {Object} options - Formatting options
 * @param {string} [options.locale] - Locale for formatting (defaults to browser locale)
 * @param {string} [options.dateStyle='medium'] - 'full', 'long', 'medium', or 'short'
 */
export function formatDate(date, locale = null, options = {}) {
  if (!date) return '';

  try {
    const dateObject = new Date(date);
    const finalLocale = locale || getDefaultLocale();
    const {
      dateStyle = 'medium',
      ...restOptions
    } = options;

    return new Intl.DateTimeFormat(finalLocale, {
      dateStyle,
      ...restOptions
    }).format(dateObject);
  } catch (error) {
    return '';
  }


}
/**
 * Format a date range as a readable string
 *
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @param {Object} options - Formatting options
 * @param {string} [options.locale] - Locale for formatting
 * @param {string} [options.dateStyle='medium'] - 'full', 'long', 'medium', or 'short'
 *
 * @returns {string} Formatted date range
 *
 * @example
 * formatDateRange(new Date('2024-01-01'), new Date('2024-12-31'))
 * // "Jan 1, 2024 – Dec 31, 2024"
 */
export function formatDateRange(startDate, endDate, options = {}) {
  const {
    locale = getDefaultLocale(),
    dateStyle = 'medium'
  } = options;

  return new Intl.DateTimeFormat(locale, {
    dateStyle
  }).formatRange(startDate, endDate);
}

/**
 * Format a date with short month and day (e.g., "Jan 15")
 *
 * @param {Date} date - The date to format
 * @param {string} [locale] - Locale for formatting (defaults to browser locale)
 *
 * @returns {string} Formatted date
 *
 * @example
 * formatDateShort(new Date('2024-01-15')) // "Jan 15"
 */
export function formatDateShort(date, locale = getDefaultLocale()) {
  if (!date) return '';

  try {
    const dateObject = new Date(date);
    return dateObject.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    return '';
  }
}

/**
 * Format a date with short month, day, and year (e.g., "Jan 15, 2024")
 *
 * @param {Date} date - The date to format
 * @param {string} [locale] - Locale for formatting (defaults to browser locale)
 *
 * @returns {string} Formatted date
 *
 * @example
 * formatDateWithYear(new Date('2024-01-15')) // "Jan 15, 2024"
 */
export function formatDateWithYear(date, locale = getDefaultLocale()) {
  if (!date) return '';

  try {
    const dateObject = new Date(date);
    return dateObject.toLocaleDateString(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch (error) {
    return '';
  }
}

/**
 * Format a date with short month and year (e.g., "Jan 2024")
 *
 * @param {Date} date - The date to format
 * @param {string} [locale] - Locale for formatting (defaults to browser locale)
 *
 * @returns {string} Formatted date
 *
 * @example
 * formatDateMonthYear(new Date('2024-01-15')) // "Jan 2024"
 */
export function formatDateMonthYear(date, locale = getDefaultLocale()) {
  if (!date) return '';

  try {
    const dateObject = new Date(date);
    return dateObject.toLocaleDateString(locale, {
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    return '';
  }
}

/**
 * Format a date based on a time interval
 * Useful for chart axes where different intervals need different formats
 *
 * @param {Date} date - The date to format
 * @param {string} interval - The interval type ('1d', '1wk', '1mo')
 * @param {string} [locale] - Locale for formatting (defaults to browser locale)
 *
 * @returns {string} Formatted date
 *
 * @example
 * formatDateByInterval(new Date('2024-01-15'), '1d') // "Jan 15"
 * formatDateByInterval(new Date('2024-01-15'), '1mo') // "Jan 2024"
 */
export function formatDateByInterval(date, interval, locale = getDefaultLocale()) {
  if (!date) return '';

  if (interval === '1d' || interval === '1wk') {
    return formatDateShort(date, locale);
  } else {
    return formatDateMonthYear(date, locale);
  }
}

/**
 * Abbreviate large numbers with suffixes (K, M, B, T)
 * More control than compact notation
 *
 * @param {number} value - The number to abbreviate
 * @param {number} [decimals=1] - Number of decimal places
 *
 * @returns {string} Abbreviated number
 *
 * @example
 * abbreviateNumber(1500) // "1.5K"
 * abbreviateNumber(1500000) // "1.5M"
 * abbreviateNumber(1500000000) // "1.5B"
 * abbreviateNumber(1500000000000) // "1.5T"
 */
export function abbreviateNumber(value, decimals = 1) {
  if (value === 0) return '0';

  const suffixes = ['', 'K', 'M', 'B', 'T'];
  const tier = Math.floor(Math.log10(Math.abs(value)) / 3);

  if (tier === 0) return value.toString();

  const suffix = suffixes[tier];
  const scale = Math.pow(10, tier * 3);
  const scaled = value / scale;

  return scaled.toFixed(decimals) + suffix;
}

/**
 * Common currency codes for reference
 * @deprecated Use CURRENCIES from '@/lib/constants' instead
 */
export const COMMON_CURRENCIES = CURRENCIES;

// Format large numbers (for market cap, revenue, etc.)
export function formatLargeNumber(value, currency) {
  if (value >= 1e12) {
    return `${formatCurrency(value / 1e12, { currency })}T`;
  } else if (value >= 1e9) {
    return `${formatCurrency(value / 1e9, { currency })}B`;
  } else if (value >= 1e6) {
    return `${formatCurrency(value / 1e6, { currency })}M`;
  }
  return formatCurrency(value, { currency });
}

/**
 * Format currency with custom locale and currency
 *
 * @param {number} amount - The amount to format
 * @param {string} currency - Currency code (USD, EUR, GBP, etc.)
 * @param {string} locale - Locale for formatting (e.g., 'en-US', 'de-DE')
 *
 * @returns {string} Formatted currency string
 *
 * @example
 * formatCurrencyWithLocale(2325.25, 'USD', 'en-US') // "$2,325.25"
 * formatCurrencyWithLocale(2325.25, 'EUR', 'de-DE') // "2.325,25 €"
 */
export function formatCurrencyWithLocale(amount, currency = 'USD', locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch (error) {
    // Fallback to basic format
    return `${getCurrencySymbol(currency, locale)}${amount.toFixed(2)}`;
  }
}

/**
 * Format number with sign display (for showing changes)
 *
 * @param {number} value - The value to format
 * @param {string} currency - Currency code (USD, EUR, GBP, etc.)
 * @param {string} locale - Locale for formatting
 *
 * @returns {string} Formatted number with sign
 *
 * @example
 * formatChangeWithLocale(78.9, 'USD', 'en-US') // "+$78.90"
 * formatChangeWithLocale(-50, 'EUR', 'de-DE') // "-50,00 €"
 */
export function formatChangeWithLocale(value, currency = 'USD', locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: 'always',
    }).format(value);
  } catch (error) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${getCurrencySymbol(currency, locale)}${Math.abs(value).toFixed(2)}`;
  }
}

/**
 * Format percentage with sign display
 *
 * @param {number} value - The decimal value to format (0.0639 for 6.39%)
 * @param {string} locale - Locale for formatting
 *
 * @returns {string} Formatted percentage with sign
 *
 * @example
 * formatPercentWithLocale(0.0639, 'en-US') // "+6.39%"
 * formatPercentWithLocale(-0.05, 'de-DE') // "-5,00%"
 */
export function formatPercentWithLocale(value, locale = 'en-US') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'percent',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay: 'always',
    }).format(value);
  } catch (error) {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${(value * 100).toFixed(2)}%`;
  }
}

/**
 * Format date according to specified format pattern
 *
 * @param {Date} date - The date to format
 * @param {string} format - Format pattern ('MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD.MM.YYYY')
 *
 * @returns {string} Formatted date string
 *
 * @example
 * formatDateByPattern(new Date(2024, 9, 23), 'MM/DD/YYYY') // "10/23/2024"
 * formatDateByPattern(new Date(2024, 9, 23), 'DD/MM/YYYY') // "23/10/2024"
 * formatDateByPattern(new Date(2024, 9, 23), 'YYYY-MM-DD') // "2024-10-23"
 */
export function formatDateByPattern(date, format = 'MM/DD/YYYY') {
  if (!date) return '';

  try {
    const dateObj = new Date(date);
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const year = dateObj.getFullYear();

    switch (format) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'YYYY-MM-DD':
        return `${year}-${month}-${day}`;
      case 'DD.MM.YYYY':
        return `${day}.${month}.${year}`;
      default:
        return `${month}/${day}/${year}`;
    }
  } catch (error) {
    return '';
  }
}

/**
 * Default export with all formatting functions
 */
export default {
  formatCurrency,
  formatNumber,
  formatPercentage,
  getCurrencySymbol,
  formatWithUnit,
  formatDateRange,
  formatDate,
  formatDateShort,
  formatDateWithYear,
  formatDateMonthYear,
  formatDateByInterval,
  abbreviateNumber,
  getDefaultLocale,
  formatLargeNumber,
  formatCurrencyWithLocale,
  formatChangeWithLocale,
  formatPercentWithLocale,
  formatDateByPattern
};
