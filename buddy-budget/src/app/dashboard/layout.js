'use client'

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CategoriesProvider } from "@/providers/categories-provider";
import { WealthProvider } from "@/providers/wealth-provider";
import { AccountsProvider } from "@/providers/accounts-provider";

export default function DashboardLayout({ children }) {
   return (
      <SidebarProvider>
         <AccountsProvider>
            <WealthProvider>
               <CategoriesProvider>
                  <AppSidebar />
               <SidebarInset>
               <header className="sticky top-0 flex h-12 shrink-0 items-center gap-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="flex items-center gap-2 px-4">
                     <SidebarTrigger className="-ml-1" />
                  </div>
               </header>
               <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                  {children}
               </div>
               </SidebarInset>
               </CategoriesProvider>
            </WealthProvider>
         </AccountsProvider>
      </SidebarProvider>
   )
}