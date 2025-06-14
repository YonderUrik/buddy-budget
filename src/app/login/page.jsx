"use client"

import { ArrowRightLeft, BanknoteX, ChartCandlestick, ChartPie, GalleryVerticalEnd, Landmark } from "lucide-react"

import { LoginForm } from "@/components/login-form"
import { MagicCard } from "@/components/magicui/magic-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/config";
import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { AuthGuard } from "@/components/auth-guard";

function LoginPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-between items-center gap-2">
          <a href="#" className="flex items-center gap-2 font-medium">
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
            <LoginForm />
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
        <div className="absolute inset-0 flex flex-col justify-center p-12">
          <div className="max-w-md mx-auto">
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="bg-blue-500 text-white rounded-full p-2 mt-1">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Account Tracking</h3>
                  <p className="text-muted-foreground text-sm">Track bank accounts, credit cards, investment accounts, loans, and mortgages with support for cryptocurrency and alternative investments</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-green-500 text-white rounded-full p-2 mt-1">
                  <ArrowRightLeft className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Multi-Currency Portfolio</h3>
                  <p className="text-muted-foreground text-sm">Track international investments and assets with live exchange rates and consolidated reporting</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-purple-500 text-white rounded-full p-2 mt-1">
                  <ChartCandlestick className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Investment Performance Analytics</h3>
                  <p className="text-muted-foreground text-sm">Detailed ROI tracking, asset allocation insights, and benchmark comparisons across all investments</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-red-500 text-white rounded-full p-2 mt-1">
                  <BanknoteX className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Comprehensive Debt Tracking</h3>
                  <p className="text-muted-foreground text-sm">Monitor all liabilities with payoff strategies and automatic net worth calculations</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="bg-orange-500 text-white rounded-full p-2 mt-1">
                  <ChartPie className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Advanced Reporting & Trends</h3>
                  <p className="text-muted-foreground text-sm">Visual dashboards showing net worth progression and wealth-building insights over time</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
}

export default function LoginPageWithGuard() {
  return (
    <AuthGuard redirectIfAuthenticated={true} redirectAuthenticatedTo="/dashboard">
      <LoginPage />
    </AuthGuard>
  )
}
