'use client'

import { paths } from "@/lib/paths"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { config } from "@/lib/config"
import { ArrowRightIcon } from "lucide-react"
import { LogoHorizontal } from "../logo/logo-horizontal"
import { StepIndicator } from "./step-indicator"
import { BasicInfoStep } from "./basic-info-step"

export function OnboardingView() {
   const router = useRouter()
   const { data: session, status } = useSession()

   useEffect(() => {
      if (status === "loading") {
         return
      }
      if (status === "authenticated") {
         if (session?.user?.hasCompletedOnboarding) {
            router.push(paths.dashboard)
         } else {
            router.push(paths.onboarding)
         }
      } else {
         router.push(paths.login)
      }
   }, [status, session, router])

   const [currentStep, setCurrentStep] = useState(0)
   const [userPreferences, setUserPreferences] = useState({
      primaryCurrency: session?.user?.primaryCurrency,
      dateFormat: session?.user?.dateFormat,
   })
   const [accounts, setAccounts] = useState([])
   const [categories, setCategories] = useState([])

   const steps = ["Preferences", "Accounts", "Categories", "Complete"]

   const handleNextStep = () => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
   }

   const handlePreviousStep = () => {
      setCurrentStep((prev) => Math.max(prev - 1, 0))
   }

   return <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl bg-white rounded-xl shadow-lg overflow-hidden"
   >
      <div className="p-6 md:p-8">
         {/* HEADER */}
         <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center justify-between">
               <div className="font-bold text-2xl tracking-tight"><LogoHorizontal /></div>
               {/* <h6 className="text-2xl font-medium">
                  Welcome, {session?.user?.name}!
               </h6> */}
            </div>
         </div>

         {/* STEPPER */}
         <StepIndicator steps={steps} currentStep={currentStep} />

         {/* MAIN */}
         <div className="mt-8 min-h-[500px]">
            <AnimatePresence mode="wait">
               <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
               >
                  {currentStep === 0 && (
                     <BasicInfoStep
                        userPreferences={userPreferences}
                        setUserPreferences={setUserPreferences}
                        onNext={handleNextStep}
                     />
                  )}

                  {/* {currentStep === 1 && (
                     <AccountsStep
                        accounts={accounts}
                        setAccounts={setAccounts}
                        userPreferences={userPreferences}
                        onNext={handleNextStep}
                        onBack={handlePreviousStep}
                     />
                  )} */}

                  {/* {currentStep === 2 && (
                     <CategoriesStep
                        categories={categories}
                        setCategories={setCategories}
                        onNext={handleNextStep}
                        onBack={handlePreviousStep}
                     />
                  )} */}

                  {/* {currentStep === 3 && (
                     <CompletionStep
                        userPreferences={userPreferences}
                        accounts={accounts}
                        categories={categories}
                        onComplete={handleComplete}
                        onBack={handlePreviousStep}
                     />
                  )} */}
               </motion.div>
            </AnimatePresence>
         </div>

         {/* FOOTER */}
         <div className="text-center text-xs text-gray-400 pt-8">
            <p>© 2025 {config.appName}</p>
            <p className="mt-1">
               <a href={paths.privacy} className="hover:underline">
                  Privacy Policy
               </a>{" "}
               •{" "}
               <a href={paths.terms} className="hover:underline">
                  Terms of Service
               </a>
            </p>
         </div>
      </div>
   </motion.div>
}