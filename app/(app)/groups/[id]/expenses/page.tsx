"use client";

/** Every expense that counts between the members of a group, and «Aggiungi una spesa». */

import { use } from "react";
import { HouseholdExpensesView } from "@/components/domain/households";
import { authClient } from "@/lib/auth/client";

export default function GroupExpensesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = authClient.useSession();
  return (
    <div className="p-4 sm:p-6">
      <HouseholdExpensesView householdId={id} currency={session?.user.currency ?? "EUR"} />
    </div>
  );
}
