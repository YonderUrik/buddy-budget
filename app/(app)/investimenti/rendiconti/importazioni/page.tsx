import { redirect } from "next/navigation";

/** Preserve bookmarks after moving import management into Operations. */
export default function LegacyStatementsPage() {
  redirect("/investimenti/operazioni");
}
