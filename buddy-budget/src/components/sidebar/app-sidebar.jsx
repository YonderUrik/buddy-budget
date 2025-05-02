"use client"

import * as React from "react"
import {
  BookOpen,
  Bot,
  Command,
  Frame,
  LifeBuoy,
  Map,
  PieChart,
  Send,
  Settings2,
  SquareTerminal,
  Wallet,
} from "lucide-react"

import { NavMain } from "@/components/sidebar/nav-main"
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

export function AppSidebar({
  ...props
}) {
  const { t } = useTranslation()
  const { data: session } = useSession()

  const data = {
    user: {
      name: session?.user?.name,
      email: session?.user?.email,
      avatar: session?.user?.image,
    },
    navMain: [
      // {
      //   title: "Playground",
      //   url: "#",
      //   icon: SquareTerminal,
      //   isActive: true,
      //   items: [
      //     {
      //       title: "History",
      //       url: "#",
      //     },
      //     {
      //       title: "Starred",
      //       url: "#",
      //     },
      //     {
      //       title: "Settings",
      //       url: "#",
      //     },
      //   ],
      // },
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
        {/* <NavMain items={data.navMain} /> */}
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
