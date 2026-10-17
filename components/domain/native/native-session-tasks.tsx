"use client";

import * as React from "react";
import { useNativePlatform } from "@/lib/hooks/use-native-platform";
import { refreshPushRegistration } from "@/lib/native";

/**
 * Work the phone app does once per launch for a signed-in person: refreshes this phone's push token on the account
 * (tokens rotate; the server prunes phones unseen for months). Mounted in the authenticated layout; no UI.
 */
export function NativeSessionTasks() {
  const native = useNativePlatform();
  React.useEffect(() => {
    if (native) void refreshPushRegistration();
  }, [native]);
  return null;
}
