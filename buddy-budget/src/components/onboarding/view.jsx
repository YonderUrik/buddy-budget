'use client'

import { paths } from "@/lib/paths"
import { useSession, signOut } from "next-auth/react"
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
import { HelpCircle, ArrowRight, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { TransactionGuide } from "./transaction-guide"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"

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
   const [isSubmitting, setIsSubmitting] = useState(false)

   const steps = [
      t("onboarding.preferences"), 
      t("onboarding.accounts"), 
      t("onboarding.categories"), 
      t("common.transactions"),
      t("onboarding.complete")
   ]
   
   // Content for help dialogs for each step
   const helpContent = [
      {
         title: t("onboarding.helpBasicInfoTitle"),
         description: t("onboarding.helpBasicInfoDesc")
      },
      {
         title: t("onboarding.helpAccountsTitle"),
         description: t("onboarding.helpAccountsDesc")
      },
      {
         title: t("onboarding.helpCategoriesTitle"),
         description: t("onboarding.helpCategoriesDesc")
      },
      {
         title: t("onboarding.transactionBasics"),
         description: t("onboarding.transactionBasicsDesc")
      },
      {
         title: t("onboarding.helpCompletionTitle"),
         description: t("onboarding.helpCompletionDesc")
      }
   ]

   const handleNextStep = () => {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1))
      // Scroll to top for mobile users
      window.scrollTo(0, 0)
   }

   const handlePreviousStep = () => {
      setCurrentStep((prev) => Math.max(prev - 1, 0))
      // Scroll to top for mobile users
      window.scrollTo(0, 0)
   }
   
   const handleLogout = async () => {
      await signOut({ redirect: true, callbackUrl: paths.login })
   }

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
         if (error.response?.data?.error) {
            toast.error(t(error.response.data.error))
         } else {
            toast.error(t("errors.internalServerError"))
         }
      } finally {
         setIsSubmitting(false)
      }
   }

   return (
      <div className="w-full min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-950 px-4 py-8 flex items-center justify-center">
         <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full max-w-4xl bg-background/90 backdrop-blur-sm border border-blue-200/30 dark:border-blue-900/30 rounded-xl shadow-[0_10px_40px_rgba(37,99,235,0.15)] overflow-hidden"
         >
            <div className="p-4 sm:p-6 md:p-8">
               {/* HEADER */}
               <div className="flex flex-col gap-4 mb-6 sm:mb-8">
                  <div className="flex items-center justify-between">
                     <div className="font-bold text-xl sm:text-2xl tracking-tight text-blue-600 dark:text-blue-400">
                        <LogoHorizontal />
                     </div>
                     <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleLogout}
                        className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 transition-colors"
                     >
                        <LogOut className="h-4 w-4 mr-1" />
                        <span className="text-sm">{t("sidebar.logout")}</span>
                     </Button>
                  </div>
                  
                  <div className="flex justify-center">
                     <div className="text-center max-w-lg">
                        <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                           {t("onboarding.welcomeTitle")}
                        </h1>
                        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                           {t("onboarding.welcomeDesc")}
                        </p>
                     </div>
                  </div>
               </div>

               {/* STEPPER */}
               <StepIndicator steps={steps} currentStep={currentStep} />

               {/* HELP BUTTON */}
               <div className="flex justify-end mt-2">
                  <Dialog>
                     <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-xs flex items-center gap-1 text-gray-500 hover:text-blue-600">
                           <HelpCircle className="h-3 w-3" />
                           {t("common.help")}
                        </Button>
                     </DialogTrigger>
                     <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                           <DialogTitle>{helpContent[currentStep].title}</DialogTitle>
                           <DialogDescription>
                              {helpContent[currentStep].description}
                           </DialogDescription>
                        </DialogHeader>
                        <div className="pt-4 border-t">
                           <div className="text-sm text-muted-foreground">
                              <p className="mb-2 font-medium">{t("onboarding.stepHelp")}</p>
                              <ul className="space-y-1 list-disc pl-5">
                                 {steps.map((step, index) => (
                                    <li key={index} className={index === currentStep ? "text-blue-600 font-medium" : ""}>
                                       {step} {index === currentStep && <ArrowRight className="inline h-3 w-3" />}
                                    </li>
                                 ))}
                              </ul>
                           </div>
                        </div>
                        <DialogClose asChild>
                           <Button className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white">
                              {t("common.gotIt")}
                           </Button>
                        </DialogClose>
                     </DialogContent>
                  </Dialog>
               </div>

               {/* MAIN CONTENT */}
               <div className="mt-4 sm:mt-6 md:mt-8 min-h-[400px] sm:min-h-[500px]">
                  <AnimatePresence mode="wait">
                     <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="px-1 sm:px-3"
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
                           <div className="mb-8">
                              <TransactionGuide />
                              
                              <motion.div
                                 className="flex justify-between pt-8"
                                 initial={{ opacity: 0 }}
                                 animate={{ opacity: 1 }}
                                 transition={{ delay: 0.7, duration: 0.3 }}
                              >
                                 <Button 
                                    variant="outline" 
                                    onClick={handlePreviousStep}
                                    className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400"
                                 >
                                    {t("common.back")}
                                 </Button>
                                 <Button 
                                    onClick={handleNextStep} 
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                 >
                                    {t("common.continue")}
                                 </Button>
                              </motion.div>
                           </div>
                        )}

                        {currentStep === 4 && (
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
               
               {/* PROGRESS INDICATOR (MOBILE ONLY) */}
               <div className="mt-6 text-xs text-center text-gray-500 md:hidden">
                  {t("onboarding.stepProgress")}
               </div>
            </div>
         </motion.div>
      </div>
   )
}