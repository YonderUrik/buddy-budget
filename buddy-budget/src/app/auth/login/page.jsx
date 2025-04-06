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

export default function LoginPage() {
  const { t } = useTranslation()
  const { data: session, status, signOut, update, error, loading } = useSession()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mounted, setMounted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await signIn("credentials", { email, password })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDemoLogin = async () => {
    setIsSubmitting(true)
    try {
      await signIn("credentials", { email: "demo@example.com", password: "demopassword" })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <header className="absolute top-0 right-0 z-50 bg-transparent p-2">
        <ModeToggle />
      </header>
      <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-background to-background/95">
        {/* Features Section - Hidden on small screens */}
        <div className="bg-primary text-primary-foreground p-8 md:w-1/2 hidden md:flex flex-col justify-center relative overflow-hidden animate-fadeIn">
          {/* Background pattern */}
          <div className="absolute inset-0 bg-grid-white/[0.1] bg-[length:16px_16px] opacity-20"></div>

          <div className={`max-w-md mx-auto relative z-10 ${mounted ? 'animate-fadeIn' : 'opacity-0'}`}>
            <h1 className="text-3xl font-bold mb-8 bg-clip-text text-transparent bg-gradient-to-r from-primary-foreground to-primary-foreground/80">
              {t("features.title")}
            </h1>

            <div className="space-y-8">
              <div className={`flex items-start gap-4 transition-all duration-300 hover:translate-x-1 ${mounted ? 'animate-fadeInRight animate-delay-100' : 'opacity-0'}`}>
                <div className="bg-primary-foreground/20 p-3 rounded-xl shadow-lg">
                  <ChartLineUp className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("features.trackAssets")}</h3>
                  <p className="text-primary-foreground/90">{t("features.trackAssetsDesc")}</p>
                </div>
              </div>

              <div className={`flex items-start gap-4 transition-all duration-300 hover:translate-x-1 ${mounted ? 'animate-fadeInRight animate-delay-200' : 'opacity-0'}`}>
                <div className="bg-primary-foreground/20 p-3 rounded-xl shadow-lg">
                  <PiggyBank className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("features.budgeting")}</h3>
                  <p className="text-primary-foreground/90">{t("features.budgetingDesc")}</p>
                </div>
              </div>

              <div className={`flex items-start gap-4 transition-all duration-300 hover:translate-x-1 ${mounted ? 'animate-fadeInRight animate-delay-300' : 'opacity-0'}`}>
                <div className="bg-primary-foreground/20 p-3 rounded-xl shadow-lg">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("features.investments")}</h3>
                  <p className="text-primary-foreground/90">{t("features.investmentsDesc")}</p>
                </div>
              </div>

              <div className={`flex items-start gap-4 transition-all duration-300 hover:translate-x-1 ${mounted ? 'animate-fadeInRight animate-delay-400' : 'opacity-0'}`}>
                <div className="bg-primary-foreground/20 p-3 rounded-xl shadow-lg">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("features.multiCurrency")}</h3>
                  <p className="text-primary-foreground/90">{t("features.multiCurrencyDesc")}</p>
                </div>
              </div>

              <div className={`flex items-start gap-4 transition-all duration-300 hover:translate-x-1 ${mounted ? 'animate-fadeInRight animate-delay-500' : 'opacity-0'}`}>
                <div className="bg-primary-foreground/20 p-3 rounded-xl shadow-lg">
                  <ChartPie className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{t("features.reports")}</h3>
                  <p className="text-primary-foreground/90">{t("features.reportsDesc")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="p-8 w-full md:w-1/2 flex items-center justify-center md:mt-0 mt-10">
          <Card className={`w-full max-w-md shadow-xl border-primary/10 backdrop-blur transition-all ${mounted ? 'animate-fadeInUp shadow-lg' : 'opacity-0'}`}>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{t("auth.loginTitle")}</CardTitle>
              <CardDescription>{t("common.welcome", { appName: config.appName })}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">{t("common.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="transition-all focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium">{t("common.password")}</Label>
                    <Link href="/forgot-password" className="text-sm text-primary hover:underline transition-all hover:text-primary/80">
                      {t("common.forgotPassword")}
                    </Link>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="transition-all focus-visible:ring-primary"
                  />
                </div>
                {error && <p className="text-destructive text-sm animate-shake">{error}</p>}
                <Button
                  type="submit"
                  className="w-full transition-all hover:shadow-md relative"
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

                {/* Demo Login Button */}
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">{t("common.or")}</span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full transition-all hover:bg-primary/10 border-primary/20 hover:shadow-sm relative"
                  onClick={handleDemoLogin}
                  disabled={isSubmitting || loading}
                >
                  <span className={isSubmitting || loading ? "opacity-0" : "opacity-100"}>
                    {t("common.tryDemoAccount")}
                  </span>
                  {(isSubmitting || loading) && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  )}
                </Button>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-2">
              <p className="text-sm text-muted-foreground">
                {t("common.noAccount")}{" "}
                <Link href="/register" className="text-primary hover:underline transition-colors hover:text-primary/80">
                  {t("common.signUp")}
                </Link>
              </p>
              <div className="text-xs text-muted-foreground text-center w-full">
                {t("common.agreeToTerms")}
                <Link href="/terms" className="text-primary hover:underline transition-colors hover:text-primary/80">
                  {t("common.termsOfService")}
                </Link>{" "}
                {t("common.and")}{" "}
                <Link href="/privacy" className="text-primary hover:underline transition-colors hover:text-primary/80">
                  {t("common.privacyPolicy")}
                </Link>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </>
  )
}