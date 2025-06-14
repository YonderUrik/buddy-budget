"use client"

import { useSearchParams } from "next/navigation"
import { GalleryVerticalEnd, AlertCircle, ArrowLeft, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_NAME } from "@/lib/config"
import Link from "next/link"

export default function AuthErrorPage() {
  const searchParams = useSearchParams()
  const error = searchParams.get("error")

  const getErrorMessage = (errorType) => {
    switch (errorType) {
      case "OAuthAccountNotLinked":
        return {
          title: "Account Already Exists",
          description: "An account with this email already exists. Please sign in with your email and password, or try linking your Google account from your profile settings.",
          suggestion: "Try signing in with your email and password instead."
        }
      case "OAuthCallback":
        return {
          title: "Authentication Failed",
          description: "There was an error during the authentication process. This might be a temporary issue.",
          suggestion: "Please try signing in again."
        }
      case "AccessDenied":
        return {
          title: "Access Denied",
          description: "You denied access to your account information. To continue, please allow access when prompted.",
          suggestion: "Try signing in again and allow access when prompted."
        }
      case "Verification":
        return {
          title: "Verification Error",
          description: "The verification link is invalid or has expired.",
          suggestion: "Please request a new verification email."
        }
      default:
        return {
          title: "Authentication Error",
          description: "An unexpected error occurred during authentication.",
          suggestion: "Please try signing in again."
        }
    }
  }

  const errorInfo = getErrorMessage(error)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="flex h-16 items-center px-4 gap-4">
          <div className="flex items-center gap-2 font-medium">
            <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
              <GalleryVerticalEnd className="size-4" />
            </div>
            {APP_NAME}
          </div>
          <div className="ml-auto flex items-center gap-4">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-8 px-4 max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="size-6 text-destructive" />
            </div>
            <CardTitle className="text-xl">{errorInfo.title}</CardTitle>
            <CardDescription className="text-center">
              {errorInfo.description}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Suggestion:</strong> {errorInfo.suggestion}
              </p>
            </div>

            {error === "OAuthAccountNotLinked" && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Account Linking
                </h4>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  If you created your account with email and password, you can link your Google account later from your profile settings after signing in.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Link href="/login" className="w-full">
                <Button className="w-full">
                  <ArrowLeft className="size-4 mr-2" />
                  Back to Login
                </Button>
              </Link>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="size-4 mr-2" />
                Try Again
              </Button>
            </div>

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Need help?{" "}
                <Link href="/contact" className="text-primary hover:underline">
                  Contact Support
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
} 