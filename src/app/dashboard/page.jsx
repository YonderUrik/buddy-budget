"use client"

import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { GalleryVerticalEnd, LogOut } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { APP_NAME } from "@/lib/config"
import { AuthGuard } from "@/components/auth-guard";

function DashboardPage() {
  const { data: session } = useSession()

  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/" })
  }

  return (
    <div className="min-h-screen bg-background">
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
            <div className="text-sm text-muted-foreground">
              Welcome, {session.user?.name || session.user?.email}
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto py-8 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Dashboard</h1>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div className="bg-card text-card-foreground p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-2">Budget Overview</h3>
              <p className="text-muted-foreground">
                Track your income and expenses
              </p>
            </div>
            
            <div className="bg-card text-card-foreground p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-2">Investments</h3>
              <p className="text-muted-foreground">
                Monitor your investment portfolio
              </p>
            </div>
            
            <div className="bg-card text-card-foreground p-6 rounded-lg border">
              <h3 className="text-lg font-semibold mb-2">Goals</h3>
              <p className="text-muted-foreground">
                Set and track financial goals
              </p>
            </div>
          </div>

          <div className="mt-8 p-6 bg-muted rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Session Information</h2>
            <div className="space-y-2 text-sm">
              <p><strong>User ID:</strong> {session.user?.id}</p>
              <p><strong>Email:</strong> {session.user?.email}</p>
              <p><strong>Name:</strong> {session.user?.name || "Not provided"}</p>
              <p><strong>Image:</strong> {session.user?.image || "Not provided"}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function DashboardPageWithGuard() {
  return (
    <AuthGuard redirectIfAuthenticated={false} redirectUnauthenticatedTo="/login">
      <DashboardPage />
    </AuthGuard>
  )
} 