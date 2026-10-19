"use client";

import { authClient } from "@/lib/auth/client";
import { useWhatsNew } from "@/lib/whats-new/use-whats-new";
import { WhatsNewChip } from "./whats-new-chip";

/** Label of the current news item, if any and not dismissed; items older than the user's sign-up are not news. */
export function WhatsNewSection() {
  const createdAt = authClient.useSession().data?.user.createdAt;
  const { entry, dismiss } = useWhatsNew(undefined, createdAt ? new Date(createdAt) : undefined);
  return entry ? <WhatsNewChip entry={entry} onDismiss={dismiss} /> : null;
}
