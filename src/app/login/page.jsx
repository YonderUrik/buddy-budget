"use client"

import { ArrowRightLeft, BanknoteX, ChartCandlestick, ChartPie, GalleryVerticalEnd, Landmark } from "lucide-react"

import { LoginForm } from "@/components/login-form"
import { MagicCard } from "@/components/magicui/magic-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { APP_NAME } from "@/lib/config";
import { FlickeringGrid } from "@/components/magicui/flickering-grid";
import { AuthGuard } from "@/components/auth-guard";
import { AnimatedList } from "@/components/magicui/animated-list";

// Dynamic features data
const features = [
  {
    icon: Landmark,
    color: "bg-blue-500",
    gradientColor: "rgba(59, 130, 246, 0.1)", // blue-500
    gradientFrom: "#3b82f6",
    gradientTo: "#1e40af",
    title: "Account Tracking",
    description: "Track bank accounts, credit cards, investment accounts, loans, and mortgages with support for cryptocurrency and alternative investments"
  },
  {
    icon: ArrowRightLeft,
    color: "bg-green-500",
    gradientColor: "rgba(34, 197, 94, 0.1)", // green-500
    gradientFrom: "#22c55e",
    gradientTo: "#16a34a",
    title: "Multi-Currency Portfolio",
    description: "Track international investments and assets with live exchange rates and consolidated reporting"
  },
  {
    icon: ChartCandlestick,
    color: "bg-purple-500",
    gradientColor: "rgba(168, 85, 247, 0.1)", // purple-500
    gradientFrom: "#a855f7",
    gradientTo: "#7c3aed",
    title: "Investment Performance Analytics",
    description: "Detailed ROI tracking, asset allocation insights, and benchmark comparisons across all investments"
  },
  {
    icon: BanknoteX,
    color: "bg-red-500",
    gradientColor: "rgba(239, 68, 68, 0.1)", // red-500
    gradientFrom: "#ef4444",
    gradientTo: "#dc2626",
    title: "Comprehensive Debt Tracking",
    description: "Monitor all liabilities with payoff strategies and automatic net worth calculations"
  },
  {
    icon: ChartPie,
    color: "bg-orange-500",
    gradientColor: "rgba(249, 115, 22, 0.1)", // orange-500
    gradientFrom: "#f97316",
    gradientTo: "#ea580c",
    title: "Advanced Reporting & Trends",
    description: "Visual dashboards showing net worth progression and wealth-building insights over time"
  }
];

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
      <div className="bg-muted/2 relative hidden lg:block">
        <FlickeringGrid
          className="relative inset-0 z-0 [mask-image:radial-gradient(400px_circle_at_center,white,transparent)]"
          squareSize={4}
          gridGap={6}
          color="#60A5FA"
          maxOpacity={0.4}
          flickerChance={0.5}
        />
        <div className="absolute inset-0 flex flex-col justify-center p-4 sm:p-8 lg:p-12">
          <div className="max-w-lg mx-auto w-full">
            <div className="space-y-3 sm:space-y-4">
              <AnimatedList>
                {features.map((feature, index) => {
                  const IconComponent = feature.icon;
                  return (
                    <MagicCard
                      key={index}
                      className="cursor-pointer rounded-xl border bg-background/10 backdrop-blur-sm p-4 sm:p-6 transition-all duration-300 hover:shadow-none w-full"
                      gradientColor={feature.gradientColor}
                      gradientFrom={feature.gradientFrom}
                      gradientTo={feature.gradientTo}
                    >
                      <div className="flex items-start gap-3 sm:gap-4">
                        <div className={`${feature.color} text-white rounded-full p-2 mt-1 flex-shrink-0`}>
                          <IconComponent className="w-3 h-3 sm:w-4 sm:h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-foreground text-sm sm:text-base mb-1 sm:mb-2 line-clamp-1">{feature.title}</h3>
                          <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed line-clamp-2 sm:line-clamp-3">{feature.description}</p>
                        </div>
                      </div>
                    </MagicCard>
                  );
                })}
              </AnimatedList>
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
