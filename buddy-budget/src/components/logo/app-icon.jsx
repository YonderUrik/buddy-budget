import Image from "next/image"
import { cn } from "@/lib/utils"
import { config } from "@/lib/config"

export function AppIcon({ size = "md", className, withBackground = false }) {
   const sizeMap = {
      xs: 24,
      sm: 32,
      md: 48,
      lg: 64,
      xl: 96,
   }

   const iconSize = sizeMap[size]

   return (
      <div
         className={cn(
            "relative flex items-center justify-center",
            withBackground && "rounded-full bg-primary/10 p-2",
            className,
         )}
      >
         <Image src="/buddy-budget-icon.svg" alt={config.appName} width={iconSize} height={iconSize} priority />
      </div>
   )
}
