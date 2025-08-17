import { getDictionary, Locale } from "@/lib/dictionaries";
import Accounts from "@/components/accounts";

export default async function AccountsPage({ params }: { params: { locale: string } }) {
   const { locale } = await params;
   const dict = await getDictionary(locale as Locale);

   return (
      <Accounts dict={dict} />
   );
}