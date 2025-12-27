import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Apple from "next-auth/providers/apple";

// Define types locally to avoid Prisma imports
export enum OnboardingStep {
  NOT_STARTED = "NOT_STARTED",
  WELCOME = "WELCOME",
  USER_PROFILE = "USER_PROFILE",
  FINANCIAL_GOALS = "FINANCIAL_GOALS",
  INITIAL_NET_WORTH = "INITIAL_NET_WORTH",
  PREFERENCES = "PREFERENCES",
  COMPLETED = "COMPLETED",
}

export enum AuthProvider {
  GOOGLE = "GOOGLE",
  GITHUB = "GITHUB",
  APPLE = "APPLE",
}

export enum Currency {
  USD = "USD",
  EUR = "EUR",
  GBP = "GBP",
  JPY = "JPY",
  CAD = "CAD",
  AUD = "AUD",
  CHF = "CHF",
  CNY = "CNY",
  INR = "INR",
  BRL = "BRL",
  MXN = "MXN",
  KRW = "KRW",
  SGD = "SGD",
  HKD = "HKD",
  NZD = "NZD",
}

export enum AppTheme {
  LIGHT = "LIGHT",
  DARK = "DARK",
  SYSTEM = "SYSTEM",
}

// Extend NextAuth session types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      onboardingCompleted: boolean;
      onboardingStep: OnboardingStep;
      provider: AuthProvider | null;
      accountProvider?: string;
      accountProviderId?: string;
    } & DefaultSession["user"];
  }

  interface User {
    onboardingCompleted?: boolean;
    onboardingStep?: OnboardingStep;
    provider?: AuthProvider | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt", // Pure JWT strategy - no database adapter
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/signin",
    error: "/signin",
    newUser: "/onboarding/welcome", // Redirect new users to welcome screen
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Apple({
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Allow sign in - database sync will happen via API route
      // Store provider info in the account for later use
      if (account) {
        user.provider = account.provider as any;
      }

      return true;
    },

    async jwt({ token, user, account, trigger, session }) {
      // Initial sign in - store user data in token
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image; // NextAuth uses 'picture' for the image in JWT
        token.onboardingCompleted = user.onboardingCompleted ?? false;
        token.onboardingStep =
          user.onboardingStep ?? OnboardingStep.NOT_STARTED;
        token.provider = user.provider ?? null;

        // Store account info for database sync
        if (account) {
          token.accountProvider = account.provider;
          token.accountProviderId = account.providerAccountId;
        }
      }

      // Handle session updates (when user updates profile during onboarding)
      if (trigger === "update" && session) {
        if (session.onboardingCompleted !== undefined) {
          token.onboardingCompleted = session.onboardingCompleted;
        }
        if (session.onboardingStep !== undefined) {
          token.onboardingStep = session.onboardingStep;
        }
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string | null;
        session.user.image = token.picture as string | null;
        session.user.onboardingCompleted = token.onboardingCompleted as boolean;
        session.user.onboardingStep = token.onboardingStep as OnboardingStep;
        session.user.provider = token.provider as AuthProvider | null;
        session.user.accountProvider = token.accountProvider as
          | string
          | undefined;
        session.user.accountProviderId = token.accountProviderId as
          | string
          | undefined;
      }

      return session;
    },
  },
  debug: process.env.NODE_ENV === "development",
});
