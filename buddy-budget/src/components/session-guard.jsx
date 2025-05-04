"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { paths } from "@/lib/paths"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { useRouter } from "next/navigation"
/**
 * Session Guard component that automatically logs out the user if:
 * - The session is invalid (token.isValid is false)
 * - The user no longer exists in the database
 * - The session has expired
 */
export function SessionGuard({ children }) {
   const { data: session, status } = useSession()
   const pathname = usePathname()
   const { t } = useTranslation()
   const hasLoggedOut = useRef(false)
   const router = useRouter()

   // Public paths that don't require authentication
   const isPublicPath =
      pathname?.startsWith(paths.forgotPassword) ||
      pathname?.startsWith(paths.login) ||
      pathname?.startsWith(paths.register) ||
      pathname?.startsWith(paths.resetPassword) ||
      pathname?.startsWith('/verify') ||
      pathname?.startsWith('/api/')

   const whitelist = [
      paths.privacy,
      paths.terms,
      paths.support,
   ]

   useEffect(() => {

      if (status === "loading") return

      if (pathname === paths.root) {
         router.push(paths.login)
      }

      if (whitelist.includes(pathname)) return

      // Skip check on public paths
      if (isPublicPath && !session) return

      // Check if session is invalid or missing
      if (session && session.isValid === false && !hasLoggedOut.current) {
         hasLoggedOut.current = true
         toast.error(t('errors.sessionExpired', { defaultValue: "La tua sessione è scaduta. Effettua nuovamente l'accesso." }))
         signOut({ callbackUrl: paths.login })
      } else {
         if (!session?.user?.hasCompletedOnboarding) {
            router.push(paths.onboarding)
         } else if (pathname === paths.onboarding) {
            router.push(paths.dashboard)
         }
      }
   }, [session, isPublicPath, t, router, status])

   return children
} 