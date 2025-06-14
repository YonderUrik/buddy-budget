"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      className="group relative h-9 w-9 overflow-hidden rounded-md transition-all duration-300 hover:bg-accent hover:scale-105 active:scale-95"
    >
      <div className="relative flex h-full w-full items-center justify-center">
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-500 ease-in-out dark:-rotate-180 dark:scale-0 group-hover:rotate-12" />
        <Moon className="absolute h-4 w-4 rotate-180 scale-0 transition-all duration-500 ease-in-out dark:rotate-0 dark:scale-100 group-hover:dark:-rotate-12" />
      </div>
      <div className="absolute inset-0 -z-10 rounded-md bg-gradient-to-r from-orange-400 to-yellow-400 opacity-0 transition-opacity duration-300 group-hover:opacity-20 dark:from-blue-600 dark:to-purple-600" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  )
} 