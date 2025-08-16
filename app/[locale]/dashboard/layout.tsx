import { Logo } from "@/components/icons";
import { FloatingDock } from "@/components/ui/floating-dock";
import { getSession } from "@/lib/auth";
import { getDictionary, Locale } from "@/lib/dictionaries";
import { Icon } from "@iconify/react";
import {
   IconSettings,
   IconCategory,
   IconLogout,
   IconHelpCircle,
} from "@tabler/icons-react";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
   children,
   params
}: {
   children: React.ReactNode;
   params: { locale: string };
}) {
   const { locale } = await params;
   const dict = await getDictionary(locale as Locale);

   const session = await getSession();
   if (!session?.user) redirect(`/${locale}/auth`);
   const user = session.user as any;
   if (!user.onboarded) redirect(`/${locale}/onboarding`);

   const links = [
      {
         title: dict.dashboard.dock.home,
         icon: (
            <Logo className="h-full w-full text-neutral-500 dark:text-neutral-300" />
         ),
         href: "/dashboard",
      },
      {
         title: dict.dashboard.dock.accounts,
         icon: (
            <Icon icon="fluent:savings-16-regular" className="h-full w-full text-neutral-500 dark:text-neutral-300" />
         ),
         href: "/dashboard/accounts",
      },
      {
         title: dict.dashboard.dock.transactions,
         icon: (
            <Icon icon="streamline:credit-card-2" className="h-full w-full text-neutral-500 dark:text-neutral-300" />
         ),
         href: "/dashboard/transactions",
      },
      {
         title: dict.dashboard.dock.reports,
         icon: (
            <Icon icon="material-symbols:search-insights-rounded" className="h-full w-full text-neutral-500 dark:text-neutral-300" />
         ),
         plan: "PRO" as const,
         href: "/dashboard/reports",
      },
      {
         title: dict.dashboard.dock.investments,
         icon: (
            <Icon icon="fluent:arrow-growth-20-filled" className="h-full w-full text-neutral-500 dark:text-neutral-300" />
         ),
         plan: "PRO" as const,
         href: "/dashboard/investments",
      },
      {
         title: dict.dashboard.dock.profile,
         icon: (
            <img
               src={user?.image}
               alt="Profile"
               className="h-full w-full rounded-full object-cover"
            />
         ),
         children: [
            {
               title: dict.dashboard.dock.settings ?? "Settings",
               icon: <IconSettings className="h-full w-full text-neutral-600 dark:text-neutral-300" />,
               href: "/dashboard/settings",
            },
            {
               title: dict.dashboard.dock.categories ?? "Categories",
               icon: <IconCategory className="h-full w-full text-neutral-600 dark:text-neutral-300" />,
               href: "/dashboard/categories",
            },
            {
               title: dict.dashboard.dock.support ?? "Support",
               icon: <IconHelpCircle className="h-full w-full text-neutral-600 dark:text-neutral-300" />,
               href: "/dashboard/support",
            },
            {
               title: dict.dashboard.dock.upgrade ?? "Upgrade to Pro",
               icon: <Icon icon="ph:rocket-launch-bold" className="h-full w-full text-secondary" />,
               href: "/dashboard/upgrade",
            },
            {
               title: dict.dashboard.dock.logout ?? "Logout",
               icon: <IconLogout className="h-full w-full text-red-500" />,
               action: "logout" as const,
            },
         ],
      },
   ];

   return (
      <main className="container mx-auto max-w-7xl pt-3 px-6 flex-grow">
         {children}
         <div className="flex items-center justify-center h-[7rem] w-full">
            <FloatingDock items={links} logoutRedirect={`/${locale}/auth`} userPlan={(user?.plan || "FREE") as "FREE" | "PRO"} />
         </div>
      </main>
   );
}