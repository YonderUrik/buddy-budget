import { Suspense } from "react";
import { LoginPanel, LoginScreen } from "@/components/domain/auth";
import { safeRedirectPath } from "@/lib/auth/constants";
import { loginCapabilities } from "@/lib/selfhost";

export const dynamic = "force-dynamic";

/** Metodi di accesso letti a runtime: la stessa immagine serve installazioni diverse. */
export default function LoginPage() {
  const capabilities = loginCapabilities();
  return (
    <Suspense fallback={<LoginPanel {...capabilities} redirectTo={safeRedirectPath(null)} />}>
      <LoginScreen {...capabilities} />
    </Suspense>
  );
}
