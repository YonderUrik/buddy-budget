import * as React from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { cn } from "@/lib/utils"
import { usePathname } from "next/navigation"

export function NavSecondary({
  items,
  className,
  ...props
}) {
  const pathname = usePathname()
  
  return (
    <SidebarGroup className={cn("mt-auto", className)} {...props}>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url
            
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton 
                  asChild 
                  size="sm"
                  isActive={isActive}
                  className={cn(
                    "transition-all duration-200 hover:bg-accent/40 group",
                    isActive && "bg-accent/60 text-accent-foreground"
                  )}
                >
                  <a href={item.url} className="flex items-center gap-3">
                    <div className="flex items-center justify-center size-6 rounded-full bg-muted/50 group-hover:bg-muted">
                      <item.icon className="size-3.5 group-hover:text-primary transition-colors" />
                    </div>
                    <span className="font-medium text-sm">{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
