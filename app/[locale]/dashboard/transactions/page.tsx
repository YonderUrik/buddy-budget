import Transactions from "@/components/transactions";
import { getDictionary, Locale } from "@/lib/dictionaries";

export default async function TransactionsPage({ params }: { params: { locale: string } }) {
   const { locale } = await params;
   const dict = await getDictionary(locale as Locale);

   return (
      <Transactions dict={dict} />
   );
}