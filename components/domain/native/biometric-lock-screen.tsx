"use client";

import Image from "next/image";
import { Loader2, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocalization } from "@/lib/localization/provider";
import { useBiometricLock } from "./use-biometric-lock";

/**
 * Lock screen of the phone app: covers everything while the app is in the background and asks Face ID / fingerprint
 * when it comes back (Impostazioni → «Questo telefono»). Renders nothing in a browser or with the lock off.
 */
export function BiometricLockScreen() {
  const { t: tr } = useLocalization();
  const { state, verifying, unlock } = useBiometricLock({ reason: tr("Sblocca BuddyBudget"), cancel: tr("Annulla") });
  if (state === "open") return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background px-6 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]" role="dialog" aria-modal="true" aria-label={tr("BuddyBudget è bloccata")}>
      <Image src="/brand/logo-mark.svg" alt="" width={40} height={48} className="h-12 w-auto" aria-hidden="true" />
      {state === "locked" && (
        <div className="flex w-full max-w-xs flex-col items-center gap-3 text-center">
          <p className="font-heading text-xl font-semibold">{tr("BuddyBudget è bloccata")}</p>
          <p className="text-sm text-text-2">{tr("Usa Face ID o l'impronta per vedere i tuoi conti.")}</p>
          <Button type="button" className="mt-3 h-11 w-full rounded-full text-base" onClick={unlock} disabled={verifying}>
            {verifying ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <ScanFace className="size-5" aria-hidden="true" />}
            {tr("Sblocca")}
          </Button>
        </div>
      )}
    </div>
  );
}
