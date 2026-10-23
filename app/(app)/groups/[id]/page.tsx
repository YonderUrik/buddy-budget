"use client";

/** A group: who is in, invitations, what the viewer shows, leaving. */

import { use } from "react";
import { HouseholdPage } from "@/components/domain/households";
import { authClient } from "@/lib/auth/client";

export default function GroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session } = authClient.useSession();
  return (
    <div className="p-4 sm:p-6">
      <HouseholdPage householdId={id} currency={session?.user.currency ?? "EUR"} />
    </div>
  );
}
