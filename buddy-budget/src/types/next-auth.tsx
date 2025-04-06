import { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * Estende il tipo User di default
   */
  interface User {
    id: string;
    hasCompletedOnboarding: boolean;
    primaryCurrency : string;
    dateFormat: string;
  }

  /**
   * Estende la sessione di default
   */
  interface Session {
    user: {
      id: string;
      hasCompletedOnboarding: boolean;
      primaryCurrency : string;
      dateFormat: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  /**
   * Estende l'oggetto JWT con campi personalizzati
   */
  interface JWT {
    id: string;
    hasCompletedOnboarding: boolean;
    primaryCurrency : string;
    dateFormat: string;
    isValid?: boolean;
  }
} 