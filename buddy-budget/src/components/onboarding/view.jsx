'use client'

import { paths } from "@/lib/paths"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export function OnboardingView() {
   const router = useRouter()

   const { data: session, status } = useSession()

   useEffect(() => {
      if (status === "loading") {
         return
      }
      if (status === "authenticated") {
         if (session?.user?.hasCompletedOnboarding) {
            router.push(paths.dashboard)
         } else {
            router.push(paths.onboarding)
         }
      } else {
         router.push(paths.login)
      }
   }, [status, session, router])

   return "Work in progress"
}