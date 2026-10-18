"use client";

import { useSearchParams } from "next/navigation";
import { LoginPanel } from "./login-panel";
import { safeRedirectPath } from "@/lib/auth/constants";
import { ACCOUNT_DELETED_QUERY } from "@/lib/account/constants";
import type { LoginCapabilities } from "@/lib/selfhost";

/** Legge la destinazione nel browser; i metodi disponibili arrivano dal server a runtime. */
export function LoginScreen(props: LoginCapabilities) {
  const searchParams = useSearchParams();
  const [key, value] = ACCOUNT_DELETED_QUERY.split("=");
  const notice = searchParams.get(key) === value ? "Il tuo account e tutti i tuoi dati sono stati eliminati." : undefined;
  return <LoginPanel {...props} redirectTo={safeRedirectPath(searchParams.get("redirect"))} notice={notice} />;
}
