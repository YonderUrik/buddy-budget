"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { paths } from "@/lib/paths"
import { useEffect } from "react"

export default function DashboardPage() {
   const { status, data: session } = useSession()
   const router = useRouter()

   useEffect(() => {
      if (status === "loading") {
         return
      }
      
      if (status === "authenticated" && session.isValid === true) {
         if (!session?.user?.hasCompletedOnboarding) {
            router.push(paths.onboarding)
         }
      } else {
         router.push(paths.login)
      }
   }, [status, session, router])

   return (
      <div>
         <h1>Dashboard</h1>
      </div>
   )
}