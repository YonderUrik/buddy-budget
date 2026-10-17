"use client";

import * as React from "react";
import { nativePlatform, type NativePlatform } from "@/lib/native/shell";

const noop = () => () => undefined;

/** Platform of the native app the page runs in (`ios` | `android`), or null in a browser and during server rendering. */
export function useNativePlatform(): NativePlatform | null {
  return React.useSyncExternalStore(noop, nativePlatform, () => null);
}
