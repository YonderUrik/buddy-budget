'use client'

import { paths } from "@/lib/paths"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { currencies, dateFormats, defaultExpenseCategories } from "@/lib/config"
import { LogoHorizontal } from "../logo/logo-horizontal"
import { StepIndicator } from "./step-indicator"
import { BasicInfoStep } from "./basic-info-step"
import { useTranslation } from "react-i18next"
import { AccountsStep } from "./account-step"
import { CategoriesStep } from "./categories-step"
import { CompletionStep } from "./completion-step"
import { toast } from "sonner"
import axios from "axios"

export function OnboardingView() {
   const router = useRouter()
   const { data: session, update } = useSession()

   const { t } = useTranslation()

   const [currentStep, setCurrentStep] = useState(0)
   const [userPreferences, setUserPreferences] = useState({
      primaryCurrency: session?.user?.primaryCurrency || currencies[0].code,
      dateFormat: session?.user?.dateFormat || dateFormats[0].value,
   })

   const [accounts, setAccounts] = useState([])
   const [categories, setCategories] = useState([])

   const steps = [t("onboarding.preferences"), t("onboarding.accounts"), t("onboarding.categories"), t("onboarding.complete")]

   const handleNextStep = () => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
   }

   const handlePreviousStep = () => {
      setCurrentStep((prev) => Math.max(prev - 1, 0))
   }

   const [isSubmitting, setIsSubmitting] = useState(false)

   const handleComplete = async () => {
      try {
         setIsSubmitting(true)
         const response = await axios.post("/api/complete-onboarding", {
            userPreferences,
            accounts,
            categories
         })
         if (response.status === 200) {
            // Update session values
            await update({
               primaryCurrency: userPreferences.primaryCurrency,
               dateFormat: userPreferences.dateFormat,
               hasCompletedOnboarding: true
            })
            router.push(paths.dashboard)
         }
      } catch (error) {
         if (error.response.data.error) {
            toast.error(t(error.response.data.error))
         } else {
            toast.error(t("errors.internalServerError"))
         }
      } finally {
         setIsSubmitting(false)
      }
   }

   return <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-4xl bg-background/90 backdrop-blur-sm border border-blue-200/30 dark:border-blue-900/30 rounded-xl shadow-[0_10px_40px_rgba(37,99,235,0.15)] overflow-hidden"
   >
      <div className="p-6 md:p-8">
         {/* HEADER */}
         <div className="flex flex-col gap-4 mb-8">
            <div className="flex items-center justify-center">
               <div className="font-bold text-2xl tracking-tight text-blue-600 dark:text-blue-400"><LogoHorizontal /></div>
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

                  {currentStep === 1 && (
                     <AccountsStep
                        accounts={accounts}
                        setAccounts={setAccounts}
                        userPreferences={userPreferences}
                        onNext={handleNextStep}
                        onBack={handlePreviousStep}
                     />
                  )}

                  {currentStep === 2 && (
                     <CategoriesStep
                        categories={categories}
                        setCategories={setCategories}
                        onNext={handleNextStep}
                        onBack={handlePreviousStep}
                     />
                  )}

                  {currentStep === 3 && (
                     <CompletionStep
                        userPreferences={userPreferences}
                        accounts={accounts}
                        categories={categories}
                        onComplete={handleComplete}
                        onBack={handlePreviousStep}
                        isSubmitting={isSubmitting}
                     />
                  )}
               </motion.div>
            </AnimatePresence>
         </div>
      </div>
   </motion.div>
}