import NextAuth, { type DefaultSession } from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Apple from "next-auth/providers/apple";

// Define types locally to avoid Prisma imports in Edge runtime
export enum OnboardingStep {
  NOT_STARTED = "NOT_STARTED",
  WELCOME = "WELCOME",
  USER_PROFILE = "USER_PROFILE",
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

        // Check database for existing user to get actual onboarding status
        // We use fetch instead of direct Prisma access because this callback
        // runs in Edge runtime when called from middleware
        if (user.email && typeof window === "undefined") {
          try {
            // Construct the absolute URL for the API endpoint
            const protocol = process.env.NEXTAUTH_URL?.startsWith("https")
              ? "https"
              : "http";
            const host =
              process.env.NEXTAUTH_URL?.replace(/^https?:\/\//, "") ||
              "localhost:3000";
            const baseUrl = `${protocol}://${host}`;

            const response = await fetch(`${baseUrl}/api/user/status`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: user.email }),
            });

            if (response.ok) {
              const data = await response.json();

              if (data.exists) {
                // Use actual database values for existing users
                token.onboardingCompleted = data.onboardingCompleted;
                token.onboardingStep = data.onboardingStep as OnboardingStep;
                token.provider = data.provider as AuthProvider | null;
              } else {
                // New user - use defaults
                token.onboardingCompleted = false;
                token.onboardingStep = OnboardingStep.NOT_STARTED;
                token.provider = user.provider ?? null;
              }
            } else {
              // API call failed - use defaults
              token.onboardingCompleted = user.onboardingCompleted ?? false;
              token.onboardingStep =
                user.onboardingStep ?? OnboardingStep.NOT_STARTED;
              token.provider = user.provider ?? null;
            }
          } catch (error) {
            console.error("Error fetching user status:", error);
            // Fallback to defaults on error
            token.onboardingCompleted = user.onboardingCompleted ?? false;
            token.onboardingStep =
              user.onboardingStep ?? OnboardingStep.NOT_STARTED;
            token.provider = user.provider ?? null;
          }
        } else {
          // No email or client-side - use defaults
          token.onboardingCompleted = user.onboardingCompleted ?? false;
          token.onboardingStep =
            user.onboardingStep ?? OnboardingStep.NOT_STARTED;
          token.provider = user.provider ?? null;
        }

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
