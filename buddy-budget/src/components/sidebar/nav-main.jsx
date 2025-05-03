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

export function NavMain({
  items,
  totalValue
}) {
  const { t } = useTranslation()
  const { data: session } = useSession()

  const getIconComponent = (iconName) => {
    const icon = accountIcons.find((i) => i.value === iconName)
    return icon ? icon.icon : <Wallet className="size-2 text-white" />
  }

  return (
    <SidebarGroup>
      <SidebarGroupLabel>
        {t("sidebar.wealth")}
        <span className="ml-2 text-muted-foreground">
          {formatCurrency(totalValue, session?.user?.primaryCurrency)}
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
                                      style={{ backgroundColor: subItem?.accountDetails?.color }}
                                      className="flex shrink-0  p-1 size-5 items-center justify-center rounded-md"
                                    >
                                      {getIconComponent(subItem?.accountDetails?.icon)}
                                    </div>
                                    <span className="truncate text-sm">{subItem?.accountDetails?.name}</span>
                                  </div>
                                  <div className="flex flex-col items-end text-xs shrink-0">
                                    {session?.user?.primaryCurrency === subItem?.accountDetails?.currency ? (
                                      <span>{formatCurrency(subItem.convertedValue, session?.user?.primaryCurrency)}</span>
                                    ) : (
                                      <>
                                        <span>{formatCurrency(subItem.convertedValue, session?.user?.primaryCurrency)}</span>
                                        <span className="text-muted-foreground">
                                          {formatCurrency(subItem.value, subItem?.accountDetails?.currency)}
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
