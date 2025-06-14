"use client"

import { GalleryVerticalEnd } from "lucide-react"
import { ResetPasswordForm } from "@/components/reset-password-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_NAME } from "@/lib/config"
import { useSearchParams } from "next/navigation"
import { FlickeringGrid } from "@/components/magicui/flickering-grid"
import { AuthGuard } from "@/components/auth-guard";

function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  if (!token) {
    return (
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-between items-center gap-2">
            <a href="/" className="flex items-center gap-2 font-medium">
              <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-4" />
              </div>
              {APP_NAME}
            </a>
            <ThemeToggle />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-xs text-center">
              <h2 className="text-2xl font-bold mb-4">Invalid Reset Link</h2>
              <p className="text-muted-foreground mb-6">
                This password reset link is invalid or has expired.
              </p>
              <a href="/forgot-password" className="underline underline-offset-4">
                Request a new reset link
              </a>
            </div>
          </div>
        </div>
        <div className="bg-muted relative hidden lg:block">
          <FlickeringGrid
            className="relative inset-0 z-0 [mask-image:radial-gradient(400px_circle_at_center,white,transparent)]"
            squareSize={4}
            gridGap={6}
            color="#60A5FA"
            maxOpacity={0.4}
            flickerChance={0.5}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-between items-center gap-2">
          <a href="/" className="flex items-center gap-2 font-medium">
            <div
              className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            {APP_NAME}
          </a>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-xs">
            <ResetPasswordForm token={token} />
          </div>
        </div>
      </div>
      <div className="bg-muted relative hidden lg:block">
        <FlickeringGrid
          className="relative inset-0 z-0 [mask-image:radial-gradient(400px_circle_at_center,white,transparent)]"
          squareSize={4}
          gridGap={6}
          color="#60A5FA"
          maxOpacity={0.4}
          flickerChance={0.5}
        />
      </div>
    </div>
  );
}

export default function ResetPasswordPageWithGuard() {
  return (
    <AuthGuard redirectIfAuthenticated={true} redirectAuthenticatedTo="/dashboard">
      <ResetPasswordPage />
    </AuthGuard>
  )
}