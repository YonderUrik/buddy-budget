import { Suspense } from "react";
import { PasswordResetPanel } from "@/components/domain/auth";

/** Page the emailed «Scegli una nuova password» link lands on (`?token=`, or `?error=` for an expired link). */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="h-80" aria-busy="true" />}>
      <PasswordResetPanel />
    </Suspense>
  );
}
