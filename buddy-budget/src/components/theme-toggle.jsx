"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "./ui/dropdown-menu"
import { useTranslation } from "react-i18next"
export function ModeToggle({ inSidebar = false }) {
   const { setTheme, theme } = useTheme()
   const { t } = useTranslation()

   const toggleTheme = () => {
      if (theme === 'dark') {
         setTheme('light')
      } else {
         setTheme('dark')
      }
   }

   if (inSidebar) {
      return (
         <DropdownMenuItem onClick={toggleTheme} className="hover:bg-transparent">
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            {t("sidebar.toggleTheme")}
         </DropdownMenuItem>
      )
   }
   return (
      <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:bg-transparent">
         <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
         <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
         <span className="sr-only">{t("sidebar.toggleTheme")}</span>
      </Button>
   )
}
