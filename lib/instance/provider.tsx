"use client";

import * as React from "react";
import { HOSTED_INSTANCE, type InstanceConfig } from "./config";

const InstanceContext = React.createContext<InstanceConfig>(HOSTED_INSTANCE);

/** Makes the instance configuration (self-hosted, sign-in methods) available to client components; mounted in the root layout. */
export function InstanceProvider({ value, children }: { value: InstanceConfig; children: React.ReactNode }) {
  return <InstanceContext.Provider value={value}>{children}</InstanceContext.Provider>;
}

/** The instance configuration; outside the provider, the hosted version's. */
export function useInstance(): InstanceConfig {
  return React.useContext(InstanceContext);
}
