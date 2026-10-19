import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveHomePage } from "@/lib/account/home-pages";
import { FREE_HOME_PATH, isPlanPathAvailable } from "@/lib/billing";
import { planForUser } from "@/lib/billing/plan-for-user";

/** Home: the home page chosen in Settings (Panoramica by default); on the Free plan a Pro home page becomes Liquidità. */
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  const target = resolveHomePage(session?.user.homePage);
  const tier = session ? planForUser(session.user).tier : "pro";
  redirect(isPlanPathAvailable(tier, target) ? target : FREE_HOME_PATH);
}
