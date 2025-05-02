import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import GitHubProvider from "next-auth/providers/github";
import AppleProvider from "next-auth/providers/apple";
import { compare } from "bcrypt";
import { prisma } from "@/lib/prisma";
import { paths } from "./paths";



export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    }),
    AppleProvider({
      clientId: process.env.APPLE_CLIENT_ID,
      clientSecret: process.env.APPLE_CLIENT_SECRET,
    }),
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error(credentials?.email ? "passwordRequired" : "emailRequired");
        }

        try {
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          });

          if (!user) {
            throw new Error("accountNotFound");
          }

          if (!user.isActive){
            throw new Error("userNotEnabled")
          }

          const isPasswordValid = await compare(credentials.password, user.password);

          if (!isPasswordValid) {
            throw new Error("invalidCredentials");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            hasCompletedOnboarding: user.hasCompletedOnboarding,
            primaryCurrency: user.primaryCurrency,
            dateFormat: user.dateFormat,
          };
        } catch (error) {
          if (error.message === "accountNotFound" ||
            error.message === "invalidCredentials" ||
            error.message === "emailRequired" ||
            error.message === "passwordRequired") {
            throw error;
          }
          throw new Error("loginFailed");
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account.provider === "credentials") {
        return true;
      }

      try {
        // For OAuth providers, we identify users by email
        if (!user.email) {
          return false;
        }

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existingUser) {
          // Create new user if they don't exist
          // Don't use the provider's user.id - let MongoDB generate a proper ObjectId
          const newUser = await prisma.user.create({
            data: {
              email: user.email,
              name: user.name || profile.name || 'User',
              // For OAuth users, we set a random password that can't be used
              password: Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12),
              // Optionally set profile image if provided by OAuth provider
              ...(user.image && { image: user.image }),
            },
          });
          
          // We replace the OAuth provider's user.id with our MongoDB ObjectId
          user.id = newUser.id;
        } else if (account.provider !== "credentials") {
          // Update existing user with provider data if needed
          await prisma.user.update({
            where: { email: user.email },
            data: {
              // Update name if it was empty or default
              ...((!existingUser.name || existingUser.name === 'User') && user.name && { name: user.name }),
              // Update image if provided and user doesn't already have one
              ...(user.image && !existingUser.image && { image: user.image })
            }
          });
          
          // Replace the OAuth provider's user.id with our MongoDB ObjectId
          user.id = existingUser.id;
        }

        return true;
      } catch (error) {
        return false;
      }
    },
    async jwt({ token, user, account, trigger, session }) {
      // Add user data to token when first signing in
      if (user) {
        // For OAuth sign-ins, user.id should now be the MongoDB ObjectId
        token.id = user.id;
        token.hasCompletedOnboarding = user.hasCompletedOnboarding;
        token.primaryCurrency = user.primaryCurrency;
        token.dateFormat = user.dateFormat;
        token.image = user.image;
        
        // Store OAuth provider information
        if (account) {
          token.provider = account.provider;
        }
      }

      // Allow session updates when update() is called
      if (trigger === "update" && session) {
        if (session.hasCompletedOnboarding !== undefined) token.hasCompletedOnboarding = session.hasCompletedOnboarding;
        if (session.primaryCurrency !== undefined) token.primaryCurrency = session.primaryCurrency;
        if (session.dateFormat !== undefined) token.dateFormat = session.dateFormat;
        if (session.image !== undefined) token.image = session.image;
      }

      // Check if user still exists and get updated info
      if (token.id) {
        try {
          const user = await prisma.user.findUnique({
            where: { id: token.id },
            select: {
              id: true,
              hasCompletedOnboarding: true,
              primaryCurrency: true,
              dateFormat: true,
              name: true,
              email: true,
              image: true
            }
          });

          if (!user) {
            // User no longer exists, mark token as invalid
            token.isValid = false;
          } else {
            // Update token with latest user data
            token.isValid = true;
            token.hasCompletedOnboarding = user.hasCompletedOnboarding;
            token.primaryCurrency = user.primaryCurrency;
            token.dateFormat = user.dateFormat;
            token.name = user.name;
            token.email = user.email;
            token.image = user.image;
          }
        } catch (error) {
          console.error("Error checking user existence:", error);
        }
      }

      return token;
    },
    async session({ session, token }) {
      // If token is marked as invalid, return empty session but not null
      if (token.isValid === false) {
        return { expires: session.expires };
      }

      if (token && session.user) {
        session.user.id = token.id;
        session.user.hasCompletedOnboarding = token.hasCompletedOnboarding;
        session.user.primaryCurrency = token.primaryCurrency;
        session.user.dateFormat = token.dateFormat;
        // Update other user fields if they've changed
        if (token.name) session.user.name = token.name;
        if (token.email) session.user.email = token.email;
        if (token.image) session.user.image = token.image;
      }
      return session;
    },
  },
  pages: {
    signIn: paths.login,
    error: paths.login,
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === "development",
};