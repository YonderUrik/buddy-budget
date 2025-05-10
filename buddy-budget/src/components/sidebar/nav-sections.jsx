"use client"

import { Folder, MoreHorizontal, Share, Trash2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useTranslation } from "react-i18next"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

export function NavSections({
  sections,
  className
}) {
  const { t, i18n } = useTranslation()
  const pathname = usePathname()

  return (
    <SidebarGroup className={cn("group-data-[collapsible=icon]:hidden", className)}>
      <SidebarGroupLabel className="font-medium uppercase text-xs tracking-wider">
        {t("sidebar.sections")}
      </SidebarGroupLabel>
      <SidebarMenu>
        {sections.map((item) => {
          const isActive = pathname === item.url
          
          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton 
                asChild
                isActive={isActive}
                className={cn(
                  "transition-all duration-200 group hover:bg-accent/50",
                  isActive && "bg-accent text-accent-foreground font-medium"
                )}
              >
                <a href={item.url}>
                  <item.icon className={cn(
                    "size-4 transition-transform group-hover:scale-110",
                    isActive && "text-primary"
                  )} />
                  <span>{item.name}</span>
                  {item.badge && (
                    <span className="ml-auto bg-primary/20 text-primary-foreground text-xs rounded-full px-2 py-0.5">
                      {item.badge}
                    </span>
                  )}
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
