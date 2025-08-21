import { getDictionary, Locale } from "@/lib/dictionaries";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Accounts from "@/components/accounts";

export default async function AccountsPage({ params }: { params: Promise<{ locale: string }> }) {
   const { locale } = await params;
   const dict = await getDictionary(locale as Locale);
   const session = await getSession();
   const user = session?.user as any;

   // Get user's current plan from database to ensure we have the latest plan
   let currentUserPlan = "FREE";
   if (user?.id) {
      const dbUser = await prisma.user.findUnique({
         where: { id: user.id },
         select: { plan: true }
      });
      currentUserPlan = dbUser?.plan || "FREE";
   }

   return (
      <Accounts 
        dict={dict} 
        userCurrency={user?.primaryCurrency || "EUR"} 
        userPlan={currentUserPlan}
        user={user}
      />
   );
}