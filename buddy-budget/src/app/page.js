"use client"

import LoadingPage from "@/components/loading-page"

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <div className="text-center">
        <LoadingPage />
      </div>
    </div>
  )
}

