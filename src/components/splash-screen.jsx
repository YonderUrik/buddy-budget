"use client"

import { useEffect, useState } from "react"
import { GalleryVerticalEnd } from "lucide-react"
import { FlickeringGrid } from "./magicui/flickering-grid"
import { TypingAnimation } from "./magicui/typing-animation"
import { APP_NAME } from "@/lib/config"
import { cn } from "@/lib/utils"

export function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0)
  const [showContent, setShowContent] = useState(false)

  useEffect(() => {
    // Show content after a brief delay
    const contentTimer = setTimeout(() => {
      setShowContent(true)
    }, 300)

    // Progress bar animation
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressTimer)
          // Complete splash screen after progress finishes
          setTimeout(() => {
            onComplete?.()
          }, 500)
          return 100
        }
        return prev + 2
      })
    }, 50)

    return () => {
      clearTimeout(contentTimer)
      clearInterval(progressTimer)
    }
  }, [onComplete])

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <FlickeringGrid
        className="absolute inset-0 z-0 [mask-image:radial-gradient(600px_circle_at_center,white,transparent)]"
        squareSize={4}
        gridGap={6}
        color="#60A5FA"
        maxOpacity={0.3}
        flickerChance={0.3}
      />
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-8">
        <div className={cn(
          "transition-all duration-1000 transform",
          showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}>
          {/* Logo */}
          <div className="flex items-center justify-center mb-8">
            <div className="bg-primary text-primary-foreground flex size-16 items-center justify-center rounded-2xl shadow-lg">
              <GalleryVerticalEnd className="size-8" />
            </div>
          </div>

          {/* App Name with Typing Animation */}
          <div className="text-center mb-8">
            <TypingAnimation 
              duration={100}
              className="text-4xl font-bold mb-2"
            >
              {APP_NAME}
            </TypingAnimation>
            <p className="text-muted-foreground text-lg">
              Your Personal Finance Companion
            </p>
          </div>

          {/* Loading Progress */}
          <div className="w-64 mx-auto">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Loading...</span>
              <span className="text-sm text-muted-foreground">{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Features Preview */}
          <div className={cn(
            "mt-12 grid grid-cols-3 gap-6 max-w-md mx-auto transition-all duration-1000 delay-500",
            showContent ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          )}>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">Budget</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">Invest</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-purple-500/10 rounded-lg flex items-center justify-center mx-auto mb-2">
                <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-xs text-muted-foreground">Track</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 