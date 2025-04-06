"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft } from "lucide-react"
import { config } from "@/lib/config"
import { useEffect, useState } from "react"
import { ModeToggle } from "@/components/theme-toggle"

export default function PrivacyPage() {
   const { t, i18n } = useTranslation()
   const [mounted, setMounted] = useState(false)

   useEffect(() => {
      setMounted(true)
   }, [])

   const localeLanguage = i18n.language
   const today = new Date()
   const lastUpdated = today.toLocaleDateString(localeLanguage || 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })

   return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80">
         {/* Header */}
         <header className="border-b bg-background/60 backdrop-blur sticky top-0 z-10 shadow-sm">
            <div className="container flex h-12 items-center justify-between px-4 md:px-6">
               <Link href="/" className="transition-transform hover:scale-105">
                  <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{config.appName}</h1>
               </Link>
               <div className="ml-auto">
                  <ModeToggle />
               </div>
            </div>
         </header>

         {/* Main content */}
         <main className="container flex flex-col items-center justify-center py-8 px-4 md:px-6">
            {/* Back button */}
            <div className={`flex items-center mb-6 w-full max-w-3xl ${mounted ? 'animate-fadeIn' : 'opacity-0'}`}>
               <Button variant="outline" size="sm" asChild className="mr-2 transition-all hover:shadow-md">
                  <Link href="/">
                     <ChevronLeft className="mr-2 h-4 w-4" />
                     {t("common.back")}
                  </Link>
               </Button>
            </div>

            <Card className={`w-full max-w-3xl border rounded-lg shadow-lg p-6 ${mounted ? 'animate-fadeInUp' : 'opacity-0'}`}>
               <CardHeader className="px-0">
                  <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">{t("legal.privacyTitle")}</CardTitle>
                  <p className="text-muted-foreground text-sm">{t("legal.lastUpdated")}: {lastUpdated}</p>
               </CardHeader>
               <CardContent className="px-0">
                  <div className="prose prose-sm sm:prose max-w-none space-y-6">
                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-100' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection1")}</h2>
                        <p>
                           {t("legal.privacySection1Desc")}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-200' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection2")}</h2>
                        <p>
                           {t("legal.privacySection2Desc")}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-300' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection3")}</h2>
                        <p>
                           {t("legal.privacySection3Desc")}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-400' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection4")}</h2>
                        <p>
                           {t("legal.privacySection4Desc")}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-500' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection5")}</h2>
                        <p>
                           {t("legal.privacySection5Desc", { contactEmail: config.supportEmail })}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-600' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection6")}</h2>
                        <p>
                           {t("legal.privacySection6Desc")}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-700' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection7")}</h2>
                        <p>
                           {t("legal.privacySection7Desc")}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-800' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection8")}</h2>
                        <p>
                           {t("legal.privacySection8Desc")}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-900' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection9")}</h2>
                        <p>
                           {t("legal.privacySection9Desc")}
                        </p>
                     </div>

                     <div className={`transition-all duration-300 hover:bg-muted/50 p-4 rounded-md ${mounted ? 'animate-fadeIn animate-delay-1000' : 'opacity-0'}`}>
                        <h2 className="text-primary font-semibold">{t("legal.privacySection10")}</h2>
                        <p>
                           {t("legal.privacySection10Desc", { contactEmail: config.supportEmail })}
                        </p>
                     </div>
                  </div>
               </CardContent>
            </Card>
         </main>
      </div>
   )
}

