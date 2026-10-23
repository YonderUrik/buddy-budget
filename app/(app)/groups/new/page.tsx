"use client";

/** Nuovo gruppo: name, what the creator shows, invitation. */

import { NewHouseholdFlow } from "@/components/domain/households";
import { PAGE_TITLE } from "@/components/domain/shared";
import { authClient } from "@/lib/auth/client";
import { useLocalization } from "@/lib/localization/provider";

export default function NewGroupPage() {
  const { t: tr } = useLocalization();
  const { data: session } = authClient.useSession();
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-4 sm:p-6">
      <h1 className={PAGE_TITLE}>{tr("Nuovo gruppo")}</h1>
      <NewHouseholdFlow currency={session?.user.currency ?? "EUR"} />
    </div>
  );
}
