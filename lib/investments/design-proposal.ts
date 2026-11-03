"use client";
// TEMPORARY (design proposals for Daniele): `?proposta=b` switches the Performance redesign to option B. Removed before the PR.
import * as React from "react";
export function useDesignProposal(): "a" | "b" {
  const [value, setValue] = React.useState<"a" | "b">("a");
  React.useEffect(() => { if (new URLSearchParams(window.location.search).get("proposta") === "b") setValue("b"); }, []);
  return value;
}
