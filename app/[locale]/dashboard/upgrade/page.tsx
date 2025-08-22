import { getDictionary, Locale } from "@/lib/dictionaries";
import { getSession } from "@/lib/auth";
import Upgrade from "@/components/upgrade";

export default async function UpgradePage({ params }: { params: { locale: string } }) {
   const { locale } = await params;
   const dict = await getDictionary(locale as Locale);
   const session = await getSession();
   const user = session?.user as any;

   return <Upgrade dict={dict} user={user} />;
}