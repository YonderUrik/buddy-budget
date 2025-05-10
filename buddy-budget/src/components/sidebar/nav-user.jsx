"use client"

import {
  BadgeCheck,
  ChevronsUpDown,
  LogOut,
  Tags,
  UserPen,
} from "lucide-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { paths } from "@/lib/paths"
import { signOut } from "next-auth/react"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
import { ModeToggle } from "../theme-toggle"
import { cn } from "@/lib/utils"

export function NavUser({
  user,
  className
}) {
  const { isMobile } = useSidebar()
  const { t } = useTranslation()
  const router = useRouter()
  
  const getInitials = (name) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };
  
  return (
    <SidebarMenu className={className}>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground hover:bg-accent/30 transition-all duration-200 group">
              <Avatar className="h-9 w-9 rounded-md border-2 border-primary/20 group-hover:border-primary/40 transition-all duration-200 shadow-sm">
                <AvatarImage src={user.avatar} alt={user.name} className="object-cover" />
                <AvatarFallback className="rounded-md bg-gradient-to-br from-primary/90 to-primary text-primary-foreground font-bold">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg shadow-lg border-border/50 backdrop-blur-sm"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 p-3 text-left">
                <Avatar className="h-12 w-12 rounded-md border-2 border-primary/20">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-md bg-gradient-to-br from-primary/90 to-primary text-primary-foreground font-bold">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem 
                onClick={() => router.push(paths.profile)}
                className="focus:bg-primary/10 gap-2.5 cursor-pointer"
              >
                <UserPen className="size-4 text-primary" />
                {t("sidebar.profile")}
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => router.push(paths.categories)}
                className="focus:bg-primary/10 gap-2.5 cursor-pointer"
              >
                <Tags className="size-4 text-primary" />
                {t("sidebar.categories")}
              </DropdownMenuItem>
              <ModeToggle inSidebar />
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => signOut({ callbackUrl: paths.login })}
              className="focus:bg-destructive/10 gap-2.5 cursor-pointer"
            >
              <LogOut className="size-4 text-destructive" />
              {t("sidebar.logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
