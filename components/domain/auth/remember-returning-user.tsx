"use client";

/**
 * RememberReturningUser
 *
 * Mounted in the signed-in app layout, renders nothing: keeps the device-local memory of who signed in (email and
 * last method), so after «Esci» or an expired session the login page can offer «Rientra in BuddyBudget».
 */

import * as React from "react";
import { authClient } from "@/lib/auth/client";
import { rememberReturningUser, toReturningMethod } from "@/lib/auth/returning-user";

export interface RememberReturningUserProps {
  /** Email of the signed-in user, from the server session. */
  email: string;
}

export function RememberReturningUser({ email }: RememberReturningUserProps) {
  React.useEffect(() => {
    rememberReturningUser({ email, method: toReturningMethod(authClient.getLastUsedLoginMethod()) });
  }, [email]);
  return null;
}
