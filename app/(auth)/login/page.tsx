"use client";

/** Pagina di login: legge la destinazione richiesta (`?redirect=`), la valida e delega a LoginPanel. */

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { LoginPanel } from "@/components/domain/auth";
import { safeRedirectPath } from "@/lib/auth/constants";
import { ACCOUNT_DELETED_QUERY } from "@/lib/account/constants";

/** Avviso per chi arriva qui subito dopo aver eliminato l'account (`?account=eliminato`). */
const ACCOUNT_DELETED_NOTICE = "Il tuo account e tutti i tuoi dati sono stati eliminati.";

function LoginWithRedirect() {
  const searchParams = useSearchParams();
  const [key, value] = ACCOUNT_DELETED_QUERY.split("=");
  const notice = searchParams.get(key) === value ? ACCOUNT_DELETED_NOTICE : undefined;
  return <LoginPanel redirectTo={safeRedirectPath(searchParams.get("redirect"))} notice={notice} />;
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPanel redirectTo={safeRedirectPath(null)} />}>
      <LoginWithRedirect />
    </Suspense>
  );
}
