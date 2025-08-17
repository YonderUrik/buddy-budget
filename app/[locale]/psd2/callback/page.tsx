"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function Psd2CallbackPage() {
  const router = useRouter();
  const search = useSearchParams();

  useEffect(() => {
    const requisitionId = search.get("r") || search.get("ref") || search.get("requisition_id") || search.get("requisitionId");
    if (!requisitionId) {
      router.replace("/dashboard/accounts");
      return;
    }
    (async () => {
      try {
        await fetch("/api/bank-link/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requisitionId }),
        });
      } catch {
        // ignore
      } finally {
        router.replace("/dashboard/accounts");
      }
    })();
  }, [router, search]);

  return (
    <div className="p-6">Finalizing bank connection…</div>
  );
}


