"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChartIcon as ChartLineUp, PiggyBank, Wallet, PieChartIcon as ChartPie, Globe } from "lucide-react"
import { signIn, useSession } from "next-auth/react"
import { config } from "@/lib/config"
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
  const [loginError, setLoginError] = useState(() => {
    // Get error from URL params if present
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');
      return error ? t(`errors.${error}`, { defaultValue: t('errors.loginFailed') }) : "";
    }
    return "";
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if already logged in
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
    <div className="min-h-screen flex flex-col overflow-hidden bg-gradient-to-br from-background via-background/95 to-background/90 relative">
      {/* Decorative background elements */}
      <div className="absolute inset-0 bg-grid-white/[0.03] bg-[length:20px_20px] pointer-events-none"></div>
      <div className="absolute top-[-10%] right-[-5%] w-[30%] h-[40%] bg-primary/10 rounded-full blur-3xl opacity-30"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[30%] h-[40%] bg-primary/10 rounded-full blur-3xl opacity-30"></div>

      {/* Theme toggle button */}
      <header className="absolute top-4 right-4 z-50">
        <ModeToggle />
      </header>

      <div className="flex flex-col lg:flex-row flex-1 relative z-10">
        {/* Features Section - Hidden on smaller screens, compact on medium screens */}
        <div className="bg-gradient-to-br from-primary to-primary/90 text-primary-foreground py-8 px-6 lg:px-12 hidden md:block lg:w-1/2 relative overflow-hidden">
          {/* Background patterns for features section */}
          {/* <div className="absolute inset-0 bg-grid-white/[0.05] bg-[length:16px_16px]"></div>
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary-foreground/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-primary-foreground/5 rounded-full blur-xl"></div> */}

          <div className={`mx-auto relative z-10 ${mounted ? 'animate-fadeIn' : 'opacity-0'}`}>


            <h1 className="text-3xl font-bold mb-8 text-primary-foreground/90">
              {t("features.title")}
            </h1>

            <div className="space-y-6">
              {/* Feature items */}
              <div className={`feature-card p-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm shadow-lg transform transition-all duration-300 hover:translate-x-1 hover:bg-primary-foreground/15 hover:shadow-xl ${mounted ? 'animate-fadeInRight animate-delay-100' : 'opacity-0'}`}>
                <div className="flex items-start gap-4">
                  <div className="bg-primary-foreground/20 p-3 rounded-lg shadow-inner">
                    <ChartLineUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("features.trackAssets")}</h3>
                    <p className="text-primary-foreground/90">{t("features.trackAssetsDesc")}</p>
                  </div>
                </div>
              </div>

              <div className={`feature-card p-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm shadow-lg transform transition-all duration-300 hover:translate-x-1 hover:bg-primary-foreground/15 hover:shadow-xl ${mounted ? 'animate-fadeInRight animate-delay-200' : 'opacity-0'}`}>
                <div className="flex items-start gap-4">
                  <div className="bg-primary-foreground/20 p-3 rounded-lg shadow-inner">
                    <PiggyBank className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("features.budgeting")}</h3>
                    <p className="text-primary-foreground/90">{t("features.budgetingDesc")}</p>
                  </div>
                </div>
              </div>

              <div className={`feature-card p-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm shadow-lg transform transition-all duration-300 hover:translate-x-1 hover:bg-primary-foreground/15 hover:shadow-xl ${mounted ? 'animate-fadeInRight animate-delay-300' : 'opacity-0'}`}>
                <div className="flex items-start gap-4">
                  <div className="bg-primary-foreground/20 p-3 rounded-lg shadow-inner">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("features.investments")}</h3>
                    <p className="text-primary-foreground/90">{t("features.investmentsDesc")}</p>
                  </div>
                </div>
              </div>

              <div className={`feature-card p-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm shadow-lg transform transition-all duration-300 hover:translate-x-1 hover:bg-primary-foreground/15 hover:shadow-xl ${mounted ? 'animate-fadeInRight animate-delay-400' : 'opacity-0'}`}>
                <div className="flex items-start gap-4">
                  <div className="bg-primary-foreground/20 p-3 rounded-lg shadow-inner">
                    <Globe className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("features.multiCurrency")}</h3>
                    <p className="text-primary-foreground/90">{t("features.multiCurrencyDesc")}</p>
                  </div>
                </div>
              </div>

              <div className={`feature-card p-4 rounded-xl bg-primary-foreground/10 backdrop-blur-sm shadow-lg transform transition-all duration-300 hover:translate-x-1 hover:bg-primary-foreground/15 hover:shadow-xl ${mounted ? 'animate-fadeInRight animate-delay-500' : 'opacity-0'}`}>
                <div className="flex items-start gap-4">
                  <div className="bg-primary-foreground/20 p-3 rounded-lg shadow-inner">
                    <ChartPie className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{t("features.reports")}</h3>
                    <p className="text-primary-foreground/90">{t("features.reportsDesc")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-6 sm:p-8 lg:p-12">
          <div className="w-full max-w-md">

            <Card className={`shadow-2xl bg-background/80 backdrop-blur-md transition-all ${mounted ? 'animate-fadeInUp' : 'opacity-0'}`}>
              <CardHeader className="space-y-1 pb-4 flex flex-col items-center">
                <LogoHorizontal className="h-8" />
              </CardHeader>

              <CardContent className="space-y-5">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">
                      {t("common.email")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      required
                      className="h-11 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary/50 bg-background/50"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-sm font-medium">
                        {t("common.password")}
                      </Label>
                      <Link href={paths.forgotPassword} className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">
                        {t("common.forgotPassword")}
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-11 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-primary/50 bg-background/50"
                    />
                  </div>

                  {loginError && (
                    <div className="bg-destructive/10 text-destructive px-4 py-2 rounded-lg text-sm animate-shake">
                      {loginError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 rounded-lg shadow-md transition-all hover:shadow-lg relative font-medium"
                    disabled={isSubmitting || loading}
                  >
                    <span className={isSubmitting || loading ? "opacity-0" : "opacity-100"}>
                      {t("common.login")}
                    </span>
                    {(isSubmitting || loading) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-5 w-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t("common.or")}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {oauthProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      variant="outline"
                      className="w-full h-11 rounded-lg border border-input bg-background hover:bg-accent hover:text-accent-foreground flex items-center justify-center gap-2 transition-all"
                      onClick={() => signIn(provider.id)}
                      disabled={!provider.enabled || isSubmitting}
                    >
                      {provider.icon}
                      <span>{t("common.continueWith")} {provider.name}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-3 pt-0 pb-6">
                <p className="text-sm text-center text-muted-foreground">
                  {t("common.noAccount")}{" "}
                  <Link href={paths.register} className="text-primary font-medium hover:underline transition-colors">
                    {t("common.signUp")}
                  </Link>
                </p>
                <div className="text-xs text-center text-muted-foreground w-full mt-2">
                  {t("common.agreeToTerms")}{" "}
                  <Link href={paths.terms} className="text-primary hover:underline transition-colors">
                    {t("common.termsOfService")}
                  </Link>{" "}
                  {t("common.and")}{" "}
                  <Link href={paths.privacy} className="text-primary hover:underline transition-colors">
                    {t("common.privacyPolicy")}
                  </Link>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}