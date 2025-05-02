"use client"

import LoadingPage from "@/components/loading-page"
import { useRouter } from "next/navigation"
import { useEffect } from "react"
import { paths } from "@/lib/paths"

export default function HomePage() {
  const router = useRouter()

  useEffect(() => {
    router.push(paths.dashboard)
  }, [router])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        <LoadingPage />
      </div>
    </div>
  )
}

