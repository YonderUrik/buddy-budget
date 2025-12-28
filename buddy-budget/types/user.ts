import {
  User,
  UserRole,
  SubscriptionStatus,
  OnboardingStep,
  AuthProvider,
  Currency,
  FiscalYearStart,
  AppTheme,
  FinancialExperienceLevel,
} from "@prisma/client";

// ============================================================================
// User Settings Type
// ============================================================================

export interface UserSettings {
  // Date & Number Formatting
  dateFormat?: string; // e.g., "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"
  numberFormat?: string; // e.g., "en-US", "de-DE", "fr-FR"
  showDecimalPlaces?: number; // Number of decimal places for currency

  // Calendar Settings
  weekStartsOn?: "sunday" | "monday";

  // UI/Dashboard Settings
  dashboardLayout?: Record<string, unknown>;
  compactMode?: boolean;
  showGraphs?: boolean;

  // Notification Settings (simplified)
  notifications?: {
    email?: boolean;
    push?: boolean;
    inApp?: boolean;
  };
}

// ============================================================================
// Financial Goal Type
// ============================================================================

export interface FinancialGoal {
  id: string;
  type: "savings" | "debt_payoff" | "investment" | "net_worth" | "custom";
  name: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string; // ISO date string
  priority?: "low" | "medium" | "high";
  notes?: string;
}

// ============================================================================
// Cookie Consent Type
// ============================================================================

export interface CookieConsent {
  necessary: boolean;
  analytics: boolean;
  marketing: boolean;
  timestamp: string; // ISO date string
}

// ============================================================================
// Typed User (User with typed JSON fields)
// ============================================================================

export type TypedUser = Omit<
  User,
  "settings" | "financialGoals" | "cookieConsent"
> & {
  settings: UserSettings;
  financialGoals: FinancialGoal[] | null;
  cookieConsent: CookieConsent | null;
};

// ============================================================================
// User Creation Input
// ============================================================================

export interface CreateUserInput {
  email: string;
  provider: AuthProvider;
  emailVerified?: Date;
  name?: string;
  firstName?: string;
  lastName?: string;
  image?: string;
  locale?: string;
}

// ============================================================================
// User Update Input
// ============================================================================

export type UpdateUserInput = Partial<
  Omit<User, "id" | "createdAt" | "updatedAt">
>;

// ============================================================================
// User Profile Update Input (commonly updated fields)
// ============================================================================

export interface UpdateUserProfileInput {
  displayName?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  timezone?: string;
  defaultCurrency?: Currency;
  appTheme?: AppTheme;
}

// ============================================================================
// Onboarding Update Input
// ============================================================================

export interface UpdateOnboardingInput {
  onboardingStep?: OnboardingStep;
  onboardingCompleted?: boolean;
  onboardingStartedAt?: Date;
  onboardingCompletedAt?: Date;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  occupation?: string;
  country?: string;
  dateOfBirth?: Date;
  financialExperienceLevel?: FinancialExperienceLevel;
  monthlyIncomeRange?: string;
  primaryGoals?: string[];
  financialGoals?: FinancialGoal[];
  initialNetWorth?: number;
  initialNetWorthDate?: Date;
  targetNetWorth?: number;
  targetNetWorthDate?: Date;
  defaultCurrency?: Currency;
  timezone?: string;
  appTheme?: AppTheme;
}

// ============================================================================
// Subscription Update Input
// ============================================================================

export interface UpdateSubscriptionInput {
  role: UserRole;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiry?: Date;
  trialStartedAt?: Date;
  trialEndsAt?: Date;
}

// ============================================================================
// Export Prisma Enums for convenience
// ============================================================================

export {
  UserRole,
  SubscriptionStatus,
  OnboardingStep,
  AuthProvider,
  Currency,
  FiscalYearStart,
  AppTheme,
  FinancialExperienceLevel,
};

// ============================================================================
// Helper Type Guards
// ============================================================================

export function isFinancialGoal(obj: unknown): obj is FinancialGoal {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "type" in obj &&
    "name" in obj &&
    "targetAmount" in obj
  );
}

export function isUserSettings(obj: unknown): obj is UserSettings {
  return typeof obj === "object" && obj !== null;
}

export function isCookieConsent(obj: unknown): obj is CookieConsent {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "necessary" in obj &&
    "analytics" in obj &&
    "marketing" in obj &&
    "timestamp" in obj
  );
}
