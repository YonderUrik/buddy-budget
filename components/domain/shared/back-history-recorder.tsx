"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { recordBackHistoryVisit } from "@/lib/navigation";

function Recorder() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  React.useEffect(() => {
    recordBackHistoryVisit(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);
  return null;
}

/** Records every in-app visit for `BackLink` (mounted once in the app layout); renders nothing. */
export function BackHistoryRecorder() {
  return (
    <React.Suspense fallback={null}>
      <Recorder />
    </React.Suspense>
  );
}
