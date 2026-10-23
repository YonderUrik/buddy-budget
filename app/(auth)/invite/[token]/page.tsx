import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { InviteLanding } from "@/components/domain/households";
import { auth } from "@/lib/auth";
import { isHouseholdMember, loadShareableAccounts } from "@/lib/households/data";
import { loadInvitePreview } from "@/lib/households/server";

/** Invitation to a group: open to anyone with the link; accepting needs a session. */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const [preview, session] = await Promise.all([loadInvitePreview(token), auth.api.getSession({ headers: await headers() })]);
  if (preview && session && (await isHouseholdMember(session.user.id, preview.householdId))) redirect(`/panoramica?group=${preview.householdId}`);
  const accounts = session && preview?.status === "valid" ? await loadShareableAccounts(session.user.id, null) : null;
  return (
    <InviteLanding
      token={token}
      status={preview?.status ?? "missing"}
      householdName={preview?.householdName ?? ""}
      inviterName={preview?.inviterName ?? ""}
      memberNames={preview?.memberNames ?? []}
      accounts={accounts}
      currency={session?.user.currency ?? "EUR"}
    />
  );
}
