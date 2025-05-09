"use client"

import * as React from "react"
import {
  BookOpen,
  Bot,
  Command,
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
} from "@/components/ui/sidebar"
import { paths } from "@/lib/paths"
import { config } from "@/lib/config"
import { AppIcon } from "../logo/app-icon"
import { useTranslation } from "react-i18next"
import { useSession } from "next-auth/react"
import { useWealth } from "@/providers/wealth-provider"
export function AppSidebar({
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
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href={paths.dashboard}>
                <div
                  className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center">
                  <AppIcon />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{config.appName}</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavSections sections={data.sections} />
        <NavCash  items={data.navMain} totalValue={totalValue} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
