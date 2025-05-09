"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LineChartIcon as ChartLineUp, PiggyBank, Wallet, PieChartIcon as ChartPie, Globe } from "lucide-react"
import { signIn, useSession } from "next-auth/react"
import { ModeToggle } from "@/components/theme-toggle"
import { paths } from "@/lib/paths"
import { oauthProviders } from "@/providers/oauth-providers"
import { LogoHorizontal } from "@/components/logo/logo-horizontal"

export default function LoginPage() {
  const { t } = useTranslation()
  const { data: session, status, loading } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loginError, setLoginError] = useState("")

  const features = [
    {
      icon: ChartLineUp,
      title: "features.trackAssets",
      description: "features.trackAssetsDesc",
      delay: "100"
    },
    {
      icon: PiggyBank,
      title: "features.budgeting",
      description: "features.budgetingDesc",
      delay: "200"
    },
    {
      icon: Wallet,
      title: "features.investments",
      description: "features.investmentsDesc",
      delay: "300"
    },
    {
      icon: Globe,
      title: "features.multiCurrency",
      description: "features.multiCurrencyDesc",
      delay: "400"
    },
    {
      icon: ChartPie,
      title: "features.reports",
      description: "features.reportsDesc",
      delay: "500"
    }
  ]

  useEffect(() => {
    setMounted(true)
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      if (error) {
        setLoginError(t(`errors.${error}`, { defaultValue: t('errors.loginFailed') }));
      }
    }
  }, [t])

  useEffect(() => {
    if (status === "authenticated") {
      if (session?.user?.hasCompletedOnboarding) {
        window.location.href = paths.dashboard
      } else {
        window.location.href = paths.onboarding
      }
    }
  }, [status, session])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    setLoginError("")

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result.error) {
        setLoginError(t(`errors.${result.error}`, { defaultValue: t('errors.loginFailed') }))
      } else if (result.url) {
        window.location.href = result.url
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-screen flex flex-col lg:flex-row bg-background text-foreground relative overflow-hidden">
      {/* Subtle background decorative elements */}
      <div className="absolute top-0 left-0 w-1/3 h-1/3 bg-primary/5 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 right-0 w-1/3 h-1/3 bg-accent/5 rounded-full blur-[100px] translate-x-1/2 translate-y-1/2 pointer-events-none -z-10"></div>

      <header className="absolute top-4 right-4 z-50">
        <ModeToggle />
      </header>

      {/* Left Column: Login Form & Auth */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12 relative z-10">
        <main className={`w-full max-w-md space-y-6 transition-opacity duration-700 ease-in-out ${mounted ? 'opacity-100' : 'opacity-0'}`}>
          <div className="text-center space-y-3">
            <LogoHorizontal className="h-10 mx-auto" />
            <h1 className="text-2xl font-semibold tracking-tight">{t("common.loginToContinue")}</h1>
          </div>

          <div className={`bg-card p-6 sm:p-8 rounded-xl shadow-xl border border-border/50 ${mounted ? 'animate-fadeInUp' : 'opacity-0'}`}>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">
                  {t("common.email")}
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@domain.com"
                  required
                  className="h-10 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-ring/50 border-input bg-background/50 dark:bg-input"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">
                    {t("common.password")}
                  </Label>
                  <Link href={paths.forgotPassword} className="text-[10px] font-medium text-primary dark:text-primary hover:text-primary/80 dark:hover:text-primary/70 transition-colors">
                    {t("common.forgotPassword")}
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-ring/50 border-input bg-background/50 dark:bg-input"
                />
              </div>

              {loginError && (
                <div className="bg-destructive/10 text-destructive dark:text-destructive-foreground px-3 py-2 rounded-lg text-xs animate-shake border border-destructive/20">
                  {loginError}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-10 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all hover:shadow-lg font-medium text-sm"
                disabled={isSubmitting || loading}
              >
                <span className={isSubmitting || loading ? "opacity-0" : "opacity-100"}>
                  {t("common.login")}
                </span>
                {(isSubmitting || loading) && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                  </div>
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/30" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 py-0.5 rounded-full text-muted-foreground text-[10px]">{t("common.or")}</span>
              </div>
            </div>

            <div className="space-y-2">
              {oauthProviders.map((provider) => (
                <Button
                  key={provider.id}
                  variant="outline"
                  className="w-full h-10 rounded-lg border border-border/30 bg-background/50 dark:bg-input hover:bg-accent/10 dark:hover:bg-accent/20 hover:text-accent-foreground dark:hover:text-accent-foreground flex items-center justify-center gap-2 transition-all hover:shadow-sm group text-xs"
                  onClick={() => signIn(provider.id)}
                  disabled={!provider.enabled || isSubmitting}
                >
                  <span className="transition-transform group-hover:scale-110">{provider.icon}</span>
                  <span>{t("common.continueWith")} {provider.name}</span>
                </Button>
              ))}
            </div>

            <div className="mt-6 text-center text-xs text-muted-foreground">
              {t("common.noAccount")}{" "}
              <Link href={paths.register} className="text-primary dark:text-primary font-medium hover:underline transition-colors">
                {t("common.signUp")}
              </Link>
            </div>
          </div>

          <footer className={`text-center text-xs text-muted-foreground space-x-3 pt-6 pb-2 ${mounted ? 'animate-fadeInUp animate-delay-300' : 'opacity-0'}`}>
            <Link href={paths.terms} className="hover:text-primary hover:underline transition-colors">
              {t("common.termsOfService")}
            </Link>
            <span>&bull;</span>
            <Link href={paths.privacy} className="hover:text-primary hover:underline transition-colors">
              {t("common.privacyPolicy")}
            </Link>
          </footer>
        </main>
      </div>

      {/* Right Column: Image & Features */}
      <div className="w-full lg:w-1/2 hidden lg:flex flex-col justify-center p-6 sm:p-8 lg:p-12 relative bg-secondary">
        
        <div className={`relative z-10 space-y-6 max-w-md mx-auto transition-opacity duration-700 ease-in-out ${mounted ? 'opacity-100 animate-fadeInRight' : 'opacity-0'}`}>
          <h2 className="text-3xl font-bold text-center text-secondary-foreground mb-8">{t("features.title")}</h2>
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div
                key={index}
                className={`bg-secondary-foreground/10 backdrop-blur-sm p-4 rounded-xl shadow-lg border border-secondary-foreground/20 flex items-start space-x-4 transition-all duration-300 hover:bg-secondary-foreground/20 animate-fadeInUp animate-delay-${feature.delay}`}
              >
                <div className="flex-shrink-0 bg-secondary-foreground/20 text-secondary-foreground p-3 rounded-lg shadow-md">
                  <feature.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-md text-secondary-foreground">{t(feature.title)}</h3>
                  <p className="text-secondary-foreground/80 text-sm leading-snug">{t(feature.description)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}