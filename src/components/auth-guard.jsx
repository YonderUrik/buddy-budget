"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { SplashScreen } from "./splash-screen"

export function AuthGuard({ 
  children, 
  requireAuth = false, 
  redirectTo = "/login",
  redirectIfAuthenticated = false,
  redirectAuthenticatedTo = "/dashboard",
  showSplash = false 
}) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [showSplashScreen, setShowSplashScreen] = useState(showSplash)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    if (status === "loading") return // Still loading session

    // Handle splash screen completion
    if (showSplash && !isReady) {
      // Wait for splash to complete before proceeding
      return
    }

    // If user must be authenticated but isn't
    if (requireAuth && !session) {
      router.push(redirectTo)
      return
    }

    // If user shouldn't be authenticated but is
    if (redirectIfAuthenticated && session) {
      router.push(redirectAuthenticatedTo)
      return
    }

    setIsReady(true)
  }, [session, status, requireAuth, redirectIfAuthenticated, router, redirectTo, redirectAuthenticatedTo, showSplash, isReady])

  const handleSplashComplete = () => {
    setShowSplashScreen(false)
    setIsReady(true)
  }

  // Show splash screen if requested and not completed
  if (showSplashScreen) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  // Show loading while session is being checked
  if (status === "loading" || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Render children if all checks pass
  return <>{children}</>
}

// Higher-order component for pages that require authentication
export function withAuth(Component, options = {}) {
  return function AuthenticatedComponent(props) {
    return (
      <AuthGuard requireAuth={true} {...options}>
        <Component {...props} />
      </AuthGuard>
    )
  }
}

// Higher-order component for pages that should redirect if authenticated (login, signup, etc.)
export function withGuest(Component, options = {}) {
  return function GuestComponent(props) {
    return (
      <AuthGuard redirectIfAuthenticated={true} {...options}>
        <Component {...props} />
      </AuthGuard>
    )
  }
} 