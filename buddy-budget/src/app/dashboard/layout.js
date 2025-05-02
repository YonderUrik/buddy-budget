'use client'

import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { CategoriesProvider } from "@/providers/categories-provider";

export default function DashboardLayout({ children }) {
   return (
      <SidebarProvider>
         <CategoriesProvider>
            <AppSidebar />
            <SidebarInset>
               <header className="flex h-16 shrink-0 items-center gap-2">
                  <div className="flex items-center gap-2 px-4">
                     <SidebarTrigger className="-ml-1" />
                  </div>
               </header>
               <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
                  {children}
               </div>
            </SidebarInset>
         </CategoriesProvider>
      </SidebarProvider>
   )
}