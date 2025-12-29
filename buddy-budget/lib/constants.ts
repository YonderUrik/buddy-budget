/**
 * Centralized constants for the application
 * All constants, configurations, and reference data in one place
 */

// ============================================================================
// CURRENCIES
// ============================================================================

export const CURRENCIES = {
  USD: { code: "USD", symbol: "$", name: "US Dollar" },
  EUR: { code: "EUR", symbol: "€", name: "Euro" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound" },
  JPY: { code: "JPY", symbol: "¥", name: "Japanese Yen" },
  CAD: { code: "CAD", symbol: "CA$", name: "Canadian Dollar" },
  AUD: { code: "AUD", symbol: "A$", name: "Australian Dollar" },
  CHF: { code: "CHF", symbol: "CHF", name: "Swiss Franc" },
  CNY: { code: "CNY", symbol: "¥", name: "Chinese Yuan" },
  INR: { code: "INR", symbol: "₹", name: "Indian Rupee" },
  BRL: { code: "BRL", symbol: "R$", name: "Brazilian Real" },
  MXN: { code: "MXN", symbol: "$", name: "Mexican Peso" },
  KRW: { code: "KRW", symbol: "₩", name: "South Korean Won" },
  SGD: { code: "SGD", symbol: "S$", name: "Singapore Dollar" },
  HKD: { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar" },
  NZD: { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar" },
} as const;

// ============================================================================
// COUNTRIES
// ============================================================================

export const COUNTRIES = [
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
] as const;

// ============================================================================
// DATE FORMATS
// ============================================================================

export const DATE_FORMATS = [
  {
    value: "MM/DD/YYYY",
    label: "MM/DD/YYYY (US Format)",
    example: "12/31/2025",
  },
  {
    value: "DD/MM/YYYY",
    label: "DD/MM/YYYY (European Format)",
    example: "31/12/2025",
  },
  {
    value: "YYYY-MM-DD",
    label: "YYYY-MM-DD (ISO Format)",
    example: "2025-12-31",
  },
  {
    value: "DD.MM.YYYY",
    label: "DD.MM.YYYY (German Format)",
    example: "31.12.2025",
  },
] as const;

// ============================================================================
// NUMBER FORMATS & LOCALES
// ============================================================================

export const NUMBER_FORMATS = [
  { value: "en-US", label: "English (US) - 1,234.56", flag: "🇺🇸" },
  { value: "en-GB", label: "English (UK) - 1,234.56", flag: "🇬🇧" },
  { value: "de-DE", label: "German - 1.234,56", flag: "🇩🇪" },
  { value: "fr-FR", label: "French - 1 234,56", flag: "🇫🇷" },
  { value: "it-IT", label: "Italian - 1.234,56", flag: "🇮🇹" },
  { value: "es-ES", label: "Spanish - 1.234,56", flag: "🇪🇸" },
  { value: "pt-BR", label: "Portuguese (Brazil) - 1.234,56", flag: "🇧🇷" },
  { value: "ja-JP", label: "Japanese - 1,234.56", flag: "🇯🇵" },
  { value: "zh-CN", label: "Chinese (Simplified) - 1,234.56", flag: "🇨🇳" },
] as const;

export const LOCALES = [
  { value: "en-US", label: "English (United States)", flag: "🇺🇸" },
  { value: "en-GB", label: "English (United Kingdom)", flag: "🇬🇧" },
  { value: "de-DE", label: "German (Germany)", flag: "🇩🇪" },
  { value: "fr-FR", label: "French (France)", flag: "🇫🇷" },
  { value: "it-IT", label: "Italian (Italy)", flag: "🇮🇹" },
  { value: "es-ES", label: "Spanish (Spain)", flag: "🇪🇸" },
  { value: "pt-BR", label: "Portuguese (Brazil)", flag: "🇧🇷" },
  { value: "ja-JP", label: "Japanese (Japan)", flag: "🇯🇵" },
  { value: "zh-CN", label: "Chinese (Simplified, China)", flag: "🇨🇳" },
] as const;

// ============================================================================
// INCOME RANGES
// ============================================================================

export const INCOME_RANGES = [
  { value: "0-2000", label: "$0 - $2,000" },
  { value: "2000-4000", label: "$2,000 - $4,000" },
  { value: "4000-6000", label: "$4,000 - $6,000" },
  { value: "6000-8000", label: "$6,000 - $8,000" },
  { value: "8000-10000", label: "$8,000 - $10,000" },
  { value: "10000+", label: "$10,000+" },
] as const;

// ============================================================================
// FINANCIAL GOALS
// ============================================================================

export const PRIMARY_GOALS = [
  { value: "save_money", label: "Save Money" },
  { value: "reduce_debt", label: "Reduce Debt" },
  { value: "invest", label: "Invest for Future" },
  { value: "track_expenses", label: "Track Expenses" },
  { value: "budget", label: "Create Budget" },
  { value: "retirement", label: "Retirement Planning" },
  { value: "buy_home", label: "Buy a Home" },
  { value: "emergency_fund", label: "Build Emergency Fund" },
] as const;

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type CurrencyCode = keyof typeof CURRENCIES;
export type CountryCode = (typeof COUNTRIES)[number]["code"];
export type DateFormatValue = (typeof DATE_FORMATS)[number]["value"];
export type NumberFormatValue = (typeof NUMBER_FORMATS)[number]["value"];
export type LocaleValue = (typeof LOCALES)[number]["value"];
export type IncomeRangeValue = (typeof INCOME_RANGES)[number]["value"];
export type PrimaryGoalValue = (typeof PRIMARY_GOALS)[number]["value"];
