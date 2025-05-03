"use client"

import { useTranslation } from "react-i18next"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronLeft, List, ExternalLink } from "lucide-react"
import { config } from "@/lib/config"
import { useEffect, useState, useRef } from "react"
import { ModeToggle } from "@/components/theme-toggle"
import { paths } from "@/lib/paths"
import { LogoHorizontal } from "@/components/logo/logo-horizontal"
import { motion } from "framer-motion"

export default function PrivacyPage() {
   const { t, i18n } = useTranslation()
   const [mounted, setMounted] = useState(false)
   const [activeSection, setActiveSection] = useState(null)
   const sectionRefs = useRef([])

   useEffect(() => {
      setMounted(true)
      
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setActiveSection(entry.target.id);
            }
          });
        },
        { threshold: 0.5 }
      );
 
      sectionRefs.current.forEach((ref) => {
        if (ref) observer.observe(ref);
      });
 
      return () => {
        sectionRefs.current.forEach((ref) => {
          if (ref) observer.unobserve(ref);
        });
      };
   }, [mounted])

   const localeLanguage = i18n.language
   const today = new Date()
   const lastUpdated = today.toLocaleDateString(localeLanguage || 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })

   const sections = Array.from({ length: 10 }, (_, i) => i + 1).map(num => ({
     id: `section${num}`,
     title: t(`legal.privacySection${num}`),
   }));

   const scrollToSection = (id) => {
     const element = document.getElementById(id);
     if (element) {
       element.scrollIntoView({ behavior: 'smooth', block: 'start' });
     }
   };

   return (
      <div className="min-h-screen bg-gradient-to-b from-background to-background/80 flex flex-col">
         {/* Header */}
         <motion.header 
           className="border-b bg-background/60 backdrop-blur sticky top-0 z-10 shadow-sm w-full"
           initial={{ opacity: 0, y: -20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ duration: 0.5 }}
         >
            <div className="container flex h-14 items-center justify-between px-4 md:px-6">
               <Link href={paths.root} className="transition-transform hover:scale-105">
                  <LogoHorizontal />
               </Link>
               <div className="ml-auto">
                  <ModeToggle />
               </div>
            </div>
         </motion.header>

         {/* Main content */}
         <main className="container mx-auto flex flex-col md:flex-row py-8 px-4 md:px-6 flex-1 gap-6">
            {/* Sidebar navigation */}
            <motion.aside 
              className={`md:w-64 shrink-0 md:sticky md:top-20 h-fit ${mounted ? 'opacity-100' : 'opacity-0'}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <Card className="p-1 sticky top-20">
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-lg font-medium flex items-center gap-2">
                    <List size={18} />
                    {t("legal.tableOfContents")}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <nav className="p-2">
                    <Button variant="ghost" size="sm" asChild className="w-full justify-start mb-2" onClick={() => scrollToSection(null)}>
                      <Link href={paths.root}>
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        {t("common.back")}
                      </Link>
                    </Button>
                    <div className="border-t my-2"></div>
                    <ul className="space-y-1">
                      {sections.map((section, index) => (
                        <li key={section.id}>
                          <Button 
                            variant={activeSection === section.id ? "secondary" : "ghost"} 
                            size="sm" 
                            className="w-full justify-start text-sm font-medium transition-all"
                            onClick={() => scrollToSection(section.id)}
                          >
                            <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                            {section.title}
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </nav>
                </CardContent>
              </Card>
            </motion.aside>

            {/* Content area */}
            <div className="flex-1 max-w-3xl mx-auto">
              <motion.div 
                className="mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                <div className="flex items-center justify-between">
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent pb-2">
                    {t("legal.privacyTitle")}
                  </h1>
                  <Button variant="outline" size="sm" asChild className="hidden md:flex">
                    <Link href={paths.terms}>
                      {t("legal.viewTermsOfService")}
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <p className="text-muted-foreground text-sm" suppressHydrationWarning>{t("legal.lastUpdated")}: {lastUpdated}</p>
              </motion.div>

              <motion.div 
                className="space-y-8 mb-12"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.4 }}
              >
                {sections.map((section, index) => (
                  <motion.section 
                    key={section.id}
                    id={section.id}
                    ref={(el) => (sectionRefs.current[index] = el)}
                    className="scroll-mt-20 bg-card border rounded-lg shadow-sm p-6 transition-all duration-300 hover:shadow-md"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.1 * index }}
                    whileHover={{ scale: 1.01 }}
                  >
                    <h2 className="text-xl font-semibold text-primary flex items-center gap-2">
                      <span className="bg-primary/10 text-primary w-8 h-8 rounded-full flex items-center justify-center text-sm">
                        {index + 1}
                      </span>
                      {section.title}
                    </h2>
                    <div className="mt-4 text-muted-foreground leading-relaxed">
                      <p>
                        {t(`legal.privacySection${index + 1}Desc`, { 
                          appName: config.appName,
                          contactEmail: config.supportEmail,
                        })}
                      </p>
                    </div>
                  </motion.section>
                ))}
              </motion.div>
            </div>
         </main>

         {/* Footer */}
         <motion.footer 
           className="border-t bg-muted/50 py-6"
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ duration: 0.5, delay: 0.6 }}
         >
           <div className="container mx-auto px-4 md:px-6">
             <div className="flex flex-col md:flex-row justify-between items-center gap-4">
               <div className="flex items-center gap-6">
                 <Link href={paths.root} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                   {t("common.home")}
                 </Link>
                 <Link href={paths.privacy} className="text-sm font-medium text-foreground">
                   {t("legal.privacyPolicy")}
                 </Link>
                 <Link href={paths.terms} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                   {t("legal.termsOfService")}
                 </Link>
               </div>
               <div className="text-sm text-muted-foreground">
                 © {new Date().getFullYear()} {config.appName}. {t("common.allRightsReserved")}
               </div>
             </div>
           </div>
         </motion.footer>
      </div>
   )
}

