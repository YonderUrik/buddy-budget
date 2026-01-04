"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

import {
  setSentryUser,
  setSentryContext,
  clearSentryUser,
} from "@/lib/sentry/user-context";

/**
 * AuthSync component
 * Syncs user data with the database after OAuth sign-in
 * This ensures users are created/updated in the database even with pure JWT sessions
 */
export function AuthSync() {
  const { data: session, status, update } = useSession();
  const hasSynced = useRef(false);

  useEffect(() => {
    async function syncUser() {
      // Only sync once per session and when authenticated
      if (status !== "authenticated" || !session?.user || hasSynced.current) {
        return;
      }

      try {
        hasSynced.current = true;

        // Call the sync endpoint to ensure user exists in database
        const response = await fetch("/api/auth/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            accountProvider: session.user.accountProvider,
            accountProviderId: session.user.accountProviderId,
          }),
        });

        if (!response.ok) {
          console.error("Failed to sync user data");

          return;
        }

        // Update session with the latest user data from database
        const data = await response.json();

        if (data.success && data.user) {
          await update({
            onboardingCompleted: data.user.onboardingCompleted,
            onboardingStep: data.user.onboardingStep,
          });

          // Set Sentry user context after successful sync
          setSentryUser(session);
          setSentryContext({
            onboardingCompleted: data.user.onboardingCompleted,
            onboardingStep: data.user.onboardingStep,
            provider: session.user.provider || undefined,
          });
        }
      } catch (error) {
        console.error("Error syncing user:", error);
      }
    }

    syncUser();
  }, [session, status, update]);

  // Update Sentry context on session change
  useEffect(() => {
    if (status === "authenticated" && session?.user) {
      setSentryUser(session);
      setSentryContext({
        onboardingCompleted: session.user.onboardingCompleted,
        onboardingStep: session.user.onboardingStep,
        provider: session.user.provider || undefined,
      });
    } else if (status === "unauthenticated") {
      clearSentryUser();
    }
  }, [session, status]);

  // This component doesn't render anything
  return null;
}
