import { getDictionary, Locale } from "@/lib/dictionaries";
import { getSession } from "@/lib/auth";
import Accounts from "@/components/accounts";

export default async function AccountsPage({ params }: { params: { locale: string } }) {
   const { locale } = await params;
   const dict = await getDictionary(locale as Locale);
   const session = await getSession();
   const user = session?.user as any;

   return (
      <Accounts dict={dict} userCurrency={user?.primaryCurrency || "EUR"} />
   );
}