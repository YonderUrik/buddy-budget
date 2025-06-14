"use client"

import { AuthGuard } from "@/components/auth-guard"

function HomePage() {
  // This component will never actually render because AuthGuard
  // will redirect based on session status
  return null
}

export default function Home() {
  return (
    <AuthGuard 
      showSplash={true}
      redirectIfAuthenticated={true}
      redirectAuthenticatedTo="/dashboard"
      redirectTo="/login"
    >
      <HomePage />
    </AuthGuard>
  )
}
