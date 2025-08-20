import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountsPieChart, CircleChartProps } from "@/components/ui/accounts-pie-chart";
import { getDictionary, Locale } from "@/lib/dictionaries";

async function getAccounts(userId: string) {
  try {
    const accounts = await (prisma as any).financialAccount.findMany({
      where: { userId, isArchived: false },
      orderBy: { name: "asc",  },
      select: {
        id: true,
        name: true,
        type: true,
        balance: true,
        currency: true,
        institutionName: true,
        institutionLogo: true,
        icon: true,
        color: true
      }
    });
    
    return accounts;
  } catch (error) {
    console.error('Failed to fetch accounts:', error);
    return [];
  }
}

export default async function DashboardPage({ params }: { params: { locale: string } }) {
  const { locale } = await params;
  const session = await getSession();
  const user = session?.user as any;

  const dict = await getDictionary(locale as Locale);
  
  // Fetch real accounts data
  const accounts = await getAccounts(user?.id);
  
  // Convert accounts to chart data format
  const chartData = accounts.map((account: any) => {
    const displayName = account.institutionName 
      ? `${account.name}` 
      : account.name;
    
    return {
      name: displayName,
      value: Math.abs(account.balance || 0),
      icon: account.icon,
      color: account.color,
      institutionLogo: account.institutionLogo,
      currency: account.currency
    };
  });

  const data: CircleChartProps = {
    title: dict.accounts.title,
    color: "secondary",
    categories: chartData.map((item: any) => item.name),
    chartData: chartData.length > 0 ? chartData : [
      { name: "No Data", value: 1 }
    ],
  };

  return (
    <div className="container mx-auto max-w-5xl py-10">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-2 mt-5">
        <AccountsPieChart {...data} />
      </div>
    </div>
  );
}


