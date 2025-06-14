"use client"

import { GalleryVerticalEnd } from "lucide-react"
import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_NAME } from "@/lib/config"
import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { AuthGuard } from "@/components/auth-guard";

function ForgotPasswordPage() {
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
            <ForgotPasswordForm />
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

export default function ForgotPasswordPageWithGuard() {
  return (
    <AuthGuard redirectIfAuthenticated={true} redirectAuthenticatedTo="/dashboard">
      <ForgotPasswordPage />
    </AuthGuard>
  )
} 