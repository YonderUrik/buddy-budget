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
import { cn } from "@/lib/utils";

export function NavCash({
  items,
  totalValue,
  className
}) {
  const { t, i18n } = useTranslation()
  const { data: session } = useSession()

  const getIconComponent = (iconName, color) => {
    const icon = accountIcons.find((i) => i.value === iconName)
    return icon ? icon.icon : <Wallet className="size-2 text-white bg-[color]" style={{ backgroundColor: color }} />
  }

  return (
    <SidebarGroup className={className}>
      <SidebarGroupLabel className="flex justify-between items-center">
        <span className="font-medium">{t("sidebar.wealth")}</span>
        <span className="text-primary-foreground bg-primary/90 text-xs rounded-full px-2.5 py-1 font-medium">
          {formatCurrency(totalValue, session?.user?.primaryCurrency, i18n.language)}
        </span>
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <Collapsible key={item.title} asChild defaultOpen={item.isActive}>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={item.title} className="hover:bg-accent/50 transition-colors">
                <item.icon className="size-4" />
                <span>{item.title}</span>
              </SidebarMenuButton>
              {item.items?.length > 0 && (
                <>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuAction className="data-[state=open]:rotate-90 transition-transform duration-200">
                      <ChevronRight className="size-4" />
                      <span className="sr-only">Toggle</span>
                    </SidebarMenuAction>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="transition-all">
                    <SidebarMenuSub>
                      {item.items.map((subItem) => (
                        <SidebarMenuSubItem key={subItem.id}>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <SidebarMenuSubButton className="hover:bg-accent/30 focus:bg-accent/50 transition-all duration-200 rounded-md overflow-hidden">
                                  <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div

                                      style={{ color: subItem?.accountDetails?.color }}
                                      className="flex shrink-0  size-4 items-center justify-center rounded-md"
                                    >
                                      {getIconComponent(subItem?.accountDetails?.icon, subItem?.accountDetails?.color)}
                                    </div>
                                    <span className="truncate font-medium">{subItem?.accountDetails?.name}</span>
                                  </div>
                                  <div className="flex flex-col items-end text-xs shrink-0">
                                    {session?.user?.primaryCurrency === subItem?.accountDetails?.currency ? (
                                      <span className="font-semibold">{formatCurrency(subItem.convertedValue, session?.user?.primaryCurrency, i18n.language)}</span>
                                    ) : (
                                      <>
                                        <span className="font-semibold">{formatCurrency(subItem.convertedValue, session?.user?.primaryCurrency, i18n.language)}</span>
                                        <span className="text-muted-foreground text-[10px]">
                                          {formatCurrency(subItem.value, subItem?.accountDetails?.currency, i18n.language)}
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </SidebarMenuSubButton>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="flex flex-col">
                                  <p className="font-medium">{subItem?.accountDetails?.name}</p>
                                  <p className="text-xs text-muted-foreground">{subItem?.accountDetails?.institution}</p>
                                </div>
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
