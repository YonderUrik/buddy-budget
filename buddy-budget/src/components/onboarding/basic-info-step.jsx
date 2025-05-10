"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"
import { Globe, DollarSign, Calendar, HelpCircle, ArrowRight } from "lucide-react"
import { PreviewCard } from "./preview-card"
import { currencies, dateFormats } from "@/lib/config"
import { useTranslation } from "react-i18next"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@/components/ui/card"

export function BasicInfoStep({ userPreferences, setUserPreferences, onNext }) {
   const { t } = useTranslation()
   const itemVariants = {
      hidden: { opacity: 0, y: 10 },
      visible: (i) => ({
         opacity: 1,
         y: 0,
         transition: {
            delay: i * 0.1,
            duration: 0.3,
         },
      }),
   }

   return (
      <div>
         <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <h2 className="text-xl sm:text-2xl font-semibold mb-2 text-blue-600 dark:text-blue-400 flex items-center gap-2">
               <Globe className="h-5 w-5" /> 
               {t("onboarding.configurePreferences")}
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
               {t("onboarding.configurePreferencesDesc")}
            </p>
         </motion.div>

         <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-8"
         >
            <Card className="border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm">
               <CardHeader className="pb-2">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                     <HelpCircle className="h-4 w-4 text-blue-500" />
                     {t("onboarding.whyThisMatters", "Why this matters")}
                  </CardTitle>
               </CardHeader>
               <CardContent className="text-sm text-gray-600 dark:text-gray-300 space-y-2">
                  <p>
                     {t("onboarding.preferencesImportance", "These preferences will be used throughout the app for displaying your financial data in a format you're comfortable with.")}
                  </p>
                  <p>
                     {t("onboarding.canBeChangedLater", "Don't worry - you can always change these settings later in your profile.")}
                  </p>
               </CardContent>
            </Card>
         </motion.div>

         <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="mb-8"
         >
            <div className="mb-3 font-medium text-gray-700 dark:text-gray-300">
               {t("onboarding.previewTitle", "Preview how your data will appear")}:
            </div>
            <PreviewCard currency={userPreferences.primaryCurrency} dateFormat={userPreferences.dateFormat} />

            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
               {t("onboarding.previewDesc")}
            </p>
         </motion.div>

         <div className="space-y-6 bg-white dark:bg-gray-800/50 p-5 rounded-lg border border-gray-100 dark:border-gray-700">
            <motion.div className="space-y-2" custom={1} initial="hidden" animate="visible" variants={itemVariants}>
               <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <Label htmlFor="currency" className="font-medium">{t("common.currency")}</Label>
                  <TooltipProvider>
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <HelpCircle className="h-3.5 w-3.5 text-gray-400 hover:text-blue-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                           <p>{t("onboarding.currencyTooltip", "This will be your primary currency for calculations and reports. Multi-currency support is available for accounts in different currencies.")}</p>
                        </TooltipContent>
                     </Tooltip>
                  </TooltipProvider>
               </div>
               <Select
                  value={userPreferences.primaryCurrency}
                  onValueChange={(value) => setUserPreferences({ ...userPreferences, primaryCurrency: value })}
               >
                  <SelectTrigger id="currency" className="w-full focus-visible:ring-blue-500/50">
                     <SelectValue placeholder={t("common.selectCurrency")} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                     {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                           <div className="flex items-center">
                              <span className="font-medium">{currency.code}</span>
                              <span className="ml-2 text-gray-500 dark:text-gray-400">- {currency.name}</span>
                           </div>
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
               <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("onboarding.currencyHelperText")}
               </p>
            </motion.div>

            <motion.div className="space-y-2" custom={2} initial="hidden" animate="visible" variants={itemVariants}>
               <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-blue-500" />
                  <Label htmlFor="dateFormat" className="font-medium">{t("common.dateFormat")}</Label>
                  <TooltipProvider>
                     <Tooltip>
                        <TooltipTrigger asChild>
                           <HelpCircle className="h-3.5 w-3.5 text-gray-400 hover:text-blue-500 cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                           <p>{t("onboarding.dateFormatTooltip", "Choose how dates will be displayed throughout the application.")}</p>
                        </TooltipContent>
                     </Tooltip>
                  </TooltipProvider>
               </div>
               <Select
                  value={userPreferences.dateFormat}
                  onValueChange={(value) => setUserPreferences({ ...userPreferences, dateFormat: value })}
               >
                  <SelectTrigger id="dateFormat" className="w-full focus-visible:ring-blue-500/50">
                     <SelectValue placeholder={t("common.selectDateFormat")} />
                  </SelectTrigger>
                  <SelectContent>
                     {dateFormats.map((format) => (
                        <SelectItem key={format.value} value={format.value}>
                           <div className="flex items-center">
                              <span className="font-medium">{format.label}</span>
                              <span className="ml-2 text-gray-500 dark:text-gray-400">({format.example})</span>
                           </div>
                        </SelectItem>
                     ))}
                  </SelectContent>
               </Select>
               <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t("onboarding.dateFormatHelperText")}
               </p>
            </motion.div>
         </div>

         <motion.div
            className="flex justify-end pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.3 }}
         >
            <Button 
               onClick={onNext} 
               className="bg-blue-600 hover:bg-blue-700 text-white space-x-2 flex items-center"
               size="lg"
            >
               <span>{t("common.continue")}</span>
               <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
         </motion.div>
      </div>
   )
}