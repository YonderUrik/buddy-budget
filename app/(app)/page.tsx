import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { resolveHomePage } from "@/lib/account/home-pages";

/** Home: rimanda alla pagina iniziale scelta dall'utente in Impostazioni (default Panoramica). */
export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });
  redirect(resolveHomePage(session?.user.homePage));
}
