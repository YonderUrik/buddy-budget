import 'server-only';

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/lib/db/client";
import { authUser, authSession, authAccount, authVerification } from "@/lib/db/schema/auth";
import { categories, DEFAULT_CATEGORIES } from "@/lib/db/schema/categories";
import { MAGIC_LINK_EXPIRES_MINUTES } from "./constants";

const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_EXPIRES_MINUTES * 60,
      sendMagicLink: async ({ email, url }) => {
        // Resend non lancia in caso di errore: restituisce `{ error }`. Lo trasformiamo in eccezione
        // così better-auth risponde con errore e la UI non mostra "controlla la tua email" a vuoto.
        const { error } = await resend.emails.send({
          from: process.env.RESEND_FROM!,
          to: email,
          subject: "Il tuo link di accesso a BuddyBudget",
          text: `Clicca qui per accedere: ${url}\n\nIl link scade tra ${MAGIC_LINK_EXPIRES_MINUTES} minuti.`,
        });
        if (error) {
          throw new Error(`Invio magic link non riuscito: ${error.message}`);
        }
      },
    }),
  ],
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  account: {
    accountLinking: {
      enabled: true,
      updateUserInfoOnLink: true,
    },
  },
  user: {
    additionalFields: {
      currency: {
        type: "string",
        defaultValue: "EUR",
        required: false,
      },
      onboardingCompleted: {
        type: "boolean",
        defaultValue: false,
        required: false,
      },
    },
  },
  databaseHooks: {
    user: {
      create: {
        /** Semina le categorie di default quando un nuovo utente viene creato via auth. */
        after: async (user) => {
          await db.insert(categories).values(
            DEFAULT_CATEGORIES.map((cat) => ({
              userId: user.id,
              name: cat.name,
              type: cat.type,
              color: cat.color,
              icon: cat.icon,
              isFallback: cat.isFallback ?? false,
            }))
          );
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
