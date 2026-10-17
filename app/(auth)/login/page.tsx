"use client";

/** Login page: reads and validates the requested destination (`?redirect=`) and delegates to LoginPanel; after an account deletion it also forgets the account remembered on this device. */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginPanel } from "@/components/domain/auth";
import { safeRedirectPath } from "@/lib/auth/constants";
import { ACCOUNT_DELETED_QUERY } from "@/lib/account/constants";

/** Notice for whoever lands here right after deleting the account (`?account=eliminato`). */
const ACCOUNT_DELETED_NOTICE = "Il tuo account e tutti i tuoi dati sono stati eliminati.";

function LoginWithRedirect() {
  const searchParams = useSearchParams();
  const [key, value] = ACCOUNT_DELETED_QUERY.split("=");
  const accountDeleted = searchParams.get(key) === value;
  return (
    <LoginPanel
      redirectTo={safeRedirectPath(searchParams.get("redirect"))}
      notice={accountDeleted ? ACCOUNT_DELETED_NOTICE : undefined}
      forgetRemembered={accountDeleted}
    />
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPanel redirectTo={safeRedirectPath(null)} />}>
      <LoginWithRedirect />
    </Suspense>
  );
}
