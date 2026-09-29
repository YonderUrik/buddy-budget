import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DeactivatedAccountPanel } from "@/components/domain/settings";
import { auth } from "@/lib/auth";

/** Pagina unica per gli account disattivati: il proxy ci manda qui finché l'account non viene riattivato. */
export default async function DeactivatedAccountPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const { deletionScheduledAt } = session.user;
  if (!deletionScheduledAt) redirect("/");
  return <DeactivatedAccountPanel deletionScheduledAt={new Date(deletionScheduledAt).toISOString()} />;
}
