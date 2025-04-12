import Image from "next/image"
import { cn } from "@/lib/utils"
import { config } from "@/lib/config"
import { AppIcon } from "./app-icon"

export function LogoHorizontal({ className }) {
   return (
      <div className={cn("flex items-center gap-2", className)}>
         <AppIcon />
         <span className="font-semibold text-xl">{config.appName}</span>
      </div>
   )
}
