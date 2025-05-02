"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import LoadingPage from "@/components/loading-page"
import { paths } from "@/lib/paths"
import { useSession } from "next-auth/react"

export default function HomePage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  useEffect(() => {
    if (status === "loading") {
      return
    }

    if (status === "authenticated" && session.isValid === true) {
      router.push(paths.dashboard)
    } else {
      router.push(paths.login)
    }
  }, [status, session, router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        <LoadingPage />
      </div>
    </div>
  )
}

