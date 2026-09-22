"use client";

/** Pagina di login: legge la destinazione richiesta (`?redirect=`), la valida e delega a LoginPanel. */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginPanel } from "@/components/domain/auth";
import { safeRedirectPath } from "@/lib/auth/constants";

function LoginWithRedirect() {
  const searchParams = useSearchParams();
  return <LoginPanel redirectTo={safeRedirectPath(searchParams.get("redirect"))} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPanel redirectTo={safeRedirectPath(null)} />}>
      <LoginWithRedirect />
    </Suspense>
  );
}
