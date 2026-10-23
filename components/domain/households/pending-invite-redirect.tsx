"use client";

/** Mounted in the app layout: a pending invitation (opened before signing in) takes the user back to it, once. */

import * as React from "react";
import { useRouter } from "next/navigation";
import { forgetPendingInvite, readPendingInvite } from "./pending-invite";

export function PendingInviteRedirect() {
  const router = useRouter();
  React.useEffect(() => {
    const token = readPendingInvite();
    if (!token) return;
    forgetPendingInvite();
    router.replace(`/invite/${token}`);
  }, [router]);
  return null;
}
