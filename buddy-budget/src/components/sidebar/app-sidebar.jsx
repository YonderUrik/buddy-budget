"use client"

import * as React from "react"
import {
  ArrowLeftRight,
  BookOpen,
  Bot,
  Command,
  FileText,
  Frame,
  HandCoins,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
  Wallet,
} from "lucide-react"

import { NavCash } from "@/components/sidebar/nav-cash"
import { NavSections } from "@/components/sidebar/nav-sections"
import { NavSecondary } from "@/components/sidebar/nav-secondary"
import { NavUser } from "@/components/sidebar/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { paths } from "@/lib/paths"
import { config } from "@/lib/config"
import { AppIcon } from "../logo/app-icon"
import { useTranslation } from "react-i18next"
import { useSession } from "next-auth/react"
import { useWealth } from "@/providers/wealth-provider"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

export function AppSidebar({
  className,
  ...props
}) {
  const { t } = useTranslation()
  const { data: session } = useSession()
  const { wealthSnapshots } = useWealth()

  const lastWealthSnapshot = wealthSnapshots[0] || {}
  const liquidityAccounts = lastWealthSnapshot?.liquidityAccounts || []

  const totalValue = lastWealthSnapshot?.totalValue || 0

  const data = React.useMemo(() => {
    return {
      user: {
        name: session?.user?.name,
        email: session?.user?.email,
        avatar: session?.user?.image,
      },
      navMain: [
        {
          title: t("sidebar.liquidity"),
          icon: HandCoins,
          isActive: true,
          items: [
            ...liquidityAccounts
          ],
        },
      ],

      sections: [
        {
          name: t("sidebar.accounts"),
          url: paths.accounts,
          icon: Wallet,
        },
        {
          name : t('sidebar.transactions'),
          url: paths.transactions,
          icon: ArrowLeftRight,
        }
      ],
      navSecondary: [
        {
          title: t("sidebar.support"),
          url: paths.support,
          icon: LifeBuoy,
        },
      ],
    }
  }, [t, session, liquidityAccounts, totalValue])

  return (
    <Sidebar 
      variant="inset" 
      className={cn("backdrop-blur-sm shadow-md", className)}
      {...props}
    >
      <SidebarHeader className="py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              size="lg" 
              asChild
              className="transition-all duration-200 hover:scale-105"
            >
              <a href={paths.dashboard} className="flex items-center gap-3">
                <div
                  className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center bg-white from-primary/80 to-primary rounded-md shadow-sm"
                >
                  <AppIcon className="size-6" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium text-base">{config.appName}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      
      <SidebarSeparator className="opacity-70" />
      
      <SidebarContent className="py-2 space-y-6">
        <NavSections sections={data.sections} />
        <NavCash items={data.navMain} totalValue={totalValue} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      
      <SidebarFooter className="pt-2">
        <SidebarSeparator className="opacity-70 mb-2" />
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
