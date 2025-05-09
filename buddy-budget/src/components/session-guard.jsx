"use client"

import { useSession, signOut } from "next-auth/react"
import { useEffect, useRef } from "react"
import { paths } from "@/lib/paths.jsx"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

/**
 * Simplified Session Guard component.
 * Its primary role now is to handle client-side session invalidation 
 * (e.g., when session.isValid becomes false based on custom JWT logic)
 * and trigger a signOut.
 * Most redirection logic is now handled by src/middleware.js.
 */
export function SessionGuard({ children }) {
   const { data: session, status } = useSession()
   const { t } = useTranslation()
   const hasLoggedOut = useRef(false) // To prevent multiple signOt invocations

   useEffect(() => {
      // Only proceed if session is loaded and actually exists
      if (status === "loading" || !session) {
         return
      }

      // If the session is marked as invalid (custom logic in your next-auth JWT callback)
      // and we haven't already initiated a logout for this reason.
      if (session.isValid === false && !hasLoggedOut.current) {
         hasLoggedOut.current = true // Mark that logout has been initiated
         toast.error(t('errors.sessionExpired', { defaultValue: "La tua sessione è scaduta. Effettua nuovamente l'accesso." }))
         signOut({ callbackUrl: paths.login }) // Sign out and redirect to login
      }
   }, [session, status, t, hasLoggedOut]) // Added hasLoggedOut to dependencies

   return children
} 