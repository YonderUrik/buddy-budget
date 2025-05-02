"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
  const [loginError, setLoginError] = useState("")

  const features = [
    {
      icon: ChartLineUp,
      gradient: "from-cyan-500 to-blue-600",
      title: "features.trackAssets",
      description: "features.trackAssetsDesc",
      delay: "100"
    },
    {
      icon: PiggyBank,
      gradient: "from-amber-500 to-orange-600",
      title: "features.budgeting",
      description: "features.budgetingDesc",
      delay: "200"
    },
    {
      icon: Wallet,
      gradient: "from-emerald-500 to-green-600",
      title: "features.investments",
      description: "features.investmentsDesc",
      delay: "300"
    },
    {
      icon: Globe,
      gradient: "from-purple-500 to-violet-600",
      title: "features.multiCurrency",
      description: "features.multiCurrencyDesc",
      delay: "400"
    },
    {
      icon: ChartPie,
      gradient: "from-pink-500 to-rose-600",
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-blue-900/20 via-background to-cyan-900/20 relative overflow-hidden">
      <div className="absolute inset-0 bg-center opacity-30"></div>
      
      <div className="absolute top-[-5%] right-[-5%] w-[35%] h-[40%] bg-blue-500/20 rounded-full blur-[100px]"></div>
      <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-cyan-500/20 rounded-full blur-[100px]"></div>
      <div className="absolute top-[30%] left-[15%] w-[20%] h-[20%] bg-sky-500/10 rounded-full blur-[80px]"></div>
      
      <header className="absolute top-4 right-4 z-50">
        <div className="bg-white/10 dark:bg-gray-800/20 backdrop-blur-md p-2 rounded-full shadow-lg border border-white/20 dark:border-gray-700/30">
          <ModeToggle />
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 relative z-10">
        <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 text-primary-foreground py-5 px-5 lg:px-8 hidden md:flex md:flex-col md:justify-center lg:w-1/2 relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('/login-image.png')] bg-cover bg-center opacity-5"></div>
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary-foreground/10 rounded-full blur-[80px]"></div>
          <div className="absolute bottom-0 left-0 w-[250px] h-[250px] bg-primary-foreground/10 rounded-full blur-[60px]"></div>

          <div className={`mx-auto max-w-lg relative z-10 ${mounted ? 'animate-fadeIn' : 'opacity-0'}`}>
            <h1 className="text-2xl font-bold mb-5 text-white flex items-center">
              <span className="ml-1">{t("features.title")}</span>
            </h1>

            <div className="space-y-3">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className={`feature-card p-3 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-lg transform transition-all duration-300 hover:translate-x-1 hover:bg-white/15 hover:border-white/30 ${mounted ? `animate-fadeInRight animate-delay-${feature.delay}` : 'opacity-0'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`bg-gradient-to-br ${feature.gradient} p-2.5 rounded-lg shadow-inner text-white`}>
                      <feature.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base mb-0.5 text-white">{t(feature.title)}</h3>
                      <p className="text-white/90 text-sm leading-snug">{t(feature.description)}</p>
                    </div>
                  </div>
                </div>
              ))}
  
            </div>
          </div>
        </div>

        <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-5 sm:p-6 lg:p-8">
          <div className="w-full max-w-md relative">
            <div className="absolute -top-16 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl"></div>

            <div className={`bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-blue-200/20 dark:border-blue-900/30 rounded-xl overflow-hidden transition-all p-6 shadow-[0_10px_40px_rgba(37,99,235,0.15)] ${mounted ? 'animate-fadeInUp' : 'opacity-0'}`}>
              <div className="space-y-1 pb-3 flex flex-col items-center">
                <div className="mb-1 relative overflow-hidden">
                  <LogoHorizontal className="h-8 relative z-10" />
                  
                </div>
                <h2 className="text-xl font-semibold tracking-tight text-center mb-0">{t("common.loginToContinue")}</h2>
              </div>

              <div className="space-y-4 pt-2">
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-medium">
                      {t("common.email")}
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@domain.com"
                      required
                      className="h-10 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-blue-500/50 border-blue-100/30 dark:border-blue-900/30 bg-white/50 dark:bg-gray-800/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password" className="text-xs font-medium">
                        {t("common.password")}
                      </Label>
                      <Link href={paths.forgotPassword} className="text-[10px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors">
                        {t("common.forgotPassword")}
                      </Link>
                    </div>
                    <Input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-10 rounded-lg transition-all focus-visible:ring-2 focus-visible:ring-blue-500/50 border-blue-100/30 dark:border-blue-900/30 bg-white/50 dark:bg-gray-800/50"
                    />
                  </div>

                  {loginError && mounted && (
                    <div className="bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2 rounded-lg text-xs animate-shake border border-red-500/20">
                      {loginError}
                    </div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-10 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white shadow-lg transition-all hover:shadow-xl relative font-medium text-sm hover:translate-y-[-1px] active:translate-y-0"
                    disabled={isSubmitting || loading}
                  >
                    <span className={isSubmitting || loading ? "opacity-0" : "opacity-100"}>
                      {t("common.login")}
                    </span>
                    {(isSubmitting || loading) && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      </div>
                    )}
                  </Button>
                </form>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-blue-200/30 dark:border-blue-800/30" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white/70 dark:bg-gray-900/70 backdrop-blur px-2 py-0.5 rounded-full text-muted-foreground text-[10px]">{t("common.or")}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {oauthProviders.map((provider) => (
                    <Button
                      key={provider.id}
                      variant="outline"
                      className="w-full h-10 rounded-lg border border-blue-200/30 dark:border-blue-800/30 bg-white/50 dark:bg-gray-800/50 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-700 dark:hover:text-blue-300 flex items-center justify-center gap-2 transition-all hover:shadow-md group text-xs"
                      onClick={() => signIn(provider.id)}
                      disabled={!provider.enabled || isSubmitting}
                    >
                      <span className="transition-transform group-hover:scale-110">{provider.icon}</span>
                      <span>{t("common.continueWith")} {provider.name}</span>
                    </Button>
                  ))}
                </div>

                <div className="flex flex-col space-y-2 pt-1">
                  <p className="text-xs text-center text-muted-foreground">
                    {t("common.noAccount")}{" "}
                    <Link href={paths.register} className="text-blue-600 dark:text-blue-400 font-medium hover:underline transition-colors">
                      {t("common.signUp")}
                    </Link>
                  </p>
                  <div className="text-[10px] text-center text-muted-foreground w-full">
                    {t("common.agreeToTerms")}{" "}
                    <Link href={paths.terms} className="text-blue-600 dark:text-blue-400 hover:underline transition-colors">
                      {t("common.termsOfService")}
                    </Link>{" "}
                    {t("common.and")}{" "}
                    <Link href={paths.privacy} className="text-blue-600 dark:text-blue-400 hover:underline transition-colors">
                      {t("common.privacyPolicy")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}