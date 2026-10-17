"use client";

/** Client part of the login page: reads and validates the requested destination (`?redirect=`) and delegates to LoginPanel; after an account deletion it also forgets the account remembered on this device. */

import { Suspense, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { LoginPanel } from "@/components/domain/auth";
import { attributionFromSearch, saveAttribution } from "@/lib/analytics/attribution";
import { safeRedirectPath } from "@/lib/auth/constants";
import { ACCOUNT_DELETED_QUERY } from "@/lib/account/constants";

/** Query flag set by the landing's «sign up» buttons (`SIGNUP_FLAG` in `landing/content/site.ts`). */
const SIGNUP_QUERY = "signup";

/** Notice for whoever lands here right after deleting the account (`?account=eliminato`). */
const ACCOUNT_DELETED_NOTICE = "Il tuo account e tutti i tuoi dati sono stati eliminati.";

export interface LoginClientProps {
  /** Link to the public demo, only when it is enabled on this instance. */
  demoHref?: string;
}

function LoginWithRedirect({ demoHref }: LoginClientProps) {
  const searchParams = useSearchParams();
  const [key, value] = ACCOUNT_DELETED_QUERY.split("=");
  const accountDeleted = searchParams.get(key) === value;
  const attribution = useMemo(() => attributionFromSearch(searchParams), [searchParams]);
  // The magic link opens after leaving this page, so the campaign is kept for the onboarding.
  useEffect(() => saveAttribution(attribution), [attribution]);
  return (
    <LoginPanel
      signup={searchParams.get(SIGNUP_QUERY) === "1"}
      attribution={attribution}
      redirectTo={safeRedirectPath(searchParams.get("redirect"))}
      notice={accountDeleted ? ACCOUNT_DELETED_NOTICE : undefined}
      forgetRemembered={accountDeleted}
      demoHref={demoHref}
    />
  );
}

export function LoginClient({ demoHref }: LoginClientProps) {
  return (
    <Suspense fallback={<LoginPanel redirectTo={safeRedirectPath(null)} demoHref={demoHref} />}>
      <LoginWithRedirect demoHref={demoHref} />
    </Suspense>
  );
}
