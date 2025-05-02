"use client"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"
import { Globe, DollarSign, Calendar } from "lucide-react"
import { PreviewCard } from "./preview-card"
import { currencies, dateFormats } from "@/lib/config"
import { useTranslation } from "react-i18next"

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
            <h2 className="text-2xl font-semibold mb-2 text-blue-600 dark:text-blue-400">{t("onboarding.configurePreferences")}</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
               {t("onboarding.configurePreferencesDesc")}
            </p>
         </motion.div>

         <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
         >
            <PreviewCard currency={userPreferences.primaryCurrency} dateFormat={userPreferences.dateFormat} />

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 mb-6">
               {t("onboarding.previewDesc")}
            </p>
         </motion.div>

         <div className="space-y-5">
            <motion.div className="space-y-2" custom={1} initial="hidden" animate="visible" variants={itemVariants}>
               <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-blue-500" />
                  <Label htmlFor="currency">{t("common.currency")}</Label>
               </div>
               <Select
                  value={userPreferences.primaryCurrency}
                  onValueChange={(value) => setUserPreferences({ ...userPreferences, primaryCurrency: value })}
               >
                  <SelectTrigger id="currency" className="w-full focus-visible:ring-blue-500/50">
                     <SelectValue placeholder={t("common.selectCurrency")} />
                  </SelectTrigger>
                  <SelectContent>
                     {currencies.map((currency) => (
                        <SelectItem key={currency.code} value={currency.code}>
                           {currency.name}
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
                  <Label htmlFor="dateFormat">{t("common.dateFormat")}</Label>
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
                           {format.label}
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
            <Button onClick={onNext} className="bg-blue-600 hover:bg-blue-700 text-white">
               {t("common.continue")}
            </Button>
         </motion.div>
      </div>
   )
}