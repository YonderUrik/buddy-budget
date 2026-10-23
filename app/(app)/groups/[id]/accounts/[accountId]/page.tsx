"use client";

/** An account another member shows the group (read-only). */

import { use } from "react";
import { HouseholdAccountView } from "@/components/domain/households";
import { authClient } from "@/lib/auth/client";

export default function GroupAccountPage({ params }: { params: Promise<{ id: string; accountId: string }> }) {
  const { id, accountId } = use(params);
  const { data: session } = authClient.useSession();
  return (
    <div className="p-4 sm:p-6">
      <HouseholdAccountView householdId={id} accountId={accountId} currency={session?.user.currency ?? "EUR"} />
    </div>
  );
}
