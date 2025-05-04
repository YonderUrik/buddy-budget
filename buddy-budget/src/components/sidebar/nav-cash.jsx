"use client"

import { ChevronRight, Wallet } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useTranslation } from "react-i18next"
import { useSession } from "next-auth/react"
import { accountIcons, formatCurrency } from "@/lib/config";

export function NavCash({
  items,
  totalValue
}) {
  const { t, i18n } = useTranslation()
  const { data: session } = useSession()

  const getIconComponent = (iconName, color) => {
    const icon = accountIcons.find((i) => i.value === iconName)
    return icon ? icon.icon : <Wallet className="size-2 text-white bg-[color]" style={{ backgroundColor: color }} />
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {t("sidebar.wealth")}
        <span className="ml-2 text-muted-foreground">
          {formatCurrency(totalValue, session?.user?.primaryCurrency, i18n.language)}
        </span>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={item.title}>
                <item.icon className="size-4" />
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.items?.length > 0 && (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90">
                      <ChevronRight className="size-4" />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.id}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuSubButton>
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div
                                      style={{ color: subItem?.accountDetails?.color }}
                                      className="flex shrink-0  size-4 items-center justify-center rounded-md"
                                    >
                                      {getIconComponent(subItem?.accountDetails?.icon, subItem?.accountDetails?.color)}
                                    </div>
                                    <span className="truncate text-xs">{subItem?.accountDetails?.name}</span>
                                  </div>
                                  <div className="flex flex-col items-end text-xs shrink-0">
                                    {session?.user?.primaryCurrency === subItem?.accountDetails?.currency ? (
                                      <span>{formatCurrency(subItem.convertedValue, session?.user?.primaryCurrency, i18n.language)}</span>
                                    ) : (
                                      <>
                                        <span>{formatCurrency(subItem.convertedValue, session?.user?.primaryCurrency, i18n.language)}</span>
                                        <span className="text-muted-foreground">
                                          {formatCurrency(subItem.value, subItem?.accountDetails?.currency, i18n.language)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </SidebarMenuSubButton>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{subItem?.accountDetails?.name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </>
              )}
            </SidebarMenuItem>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
