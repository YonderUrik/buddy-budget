"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowLeft, ArrowRight, Globe, DollarSign, Calendar, Wallet, Tag, CheckIcon, Sparkles, HelpCircle } from "lucide-react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { config, formatCurrency } from "@/lib/config"
import yahooFinance from 'yahoo-finance2';
import { useEffect, useState } from "react"
import axios from "axios"
import { Skeleton } from "@/components/ui/skeleton"
import confetti from 'canvas-confetti'
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function CompletionStep({ userPreferences, accounts, categories, onComplete, onBack, isSubmitting }) {
   const { t, i18n } = useTranslation()
   const [convertedTotals, setConvertedTotals] = useState([])
   const [isClient, setIsClient] = useState(false)

   useEffect(() => {
      setIsClient(true)
      
      // Trigger confetti effect when component mounts
      if (typeof window !== 'undefined') {
         setTimeout(() => {
            const canvas = document.createElement('canvas')
            canvas.style.position = 'fixed'
            canvas.style.top = '0'
            canvas.style.left = '0'
            canvas.style.width = '100vw'
            canvas.style.height = '100vh'
            canvas.style.pointerEvents = 'none'
            canvas.style.zIndex = '9999'
            document.body.appendChild(canvas)
            
            const myConfetti = confetti.create(canvas, {
               resize: true,
               useWorker: true
            })
            
            myConfetti({
               particleCount: 100,
               spread: 70,
               origin: { y: 0.6 },
               colors: ['#2563eb', '#3b82f6', '#60a5fa']
            })
            
            setTimeout(() => {
               document.body.removeChild(canvas)
            }, 3000)
         }, 500)
      }
   }, [])

   const balancesByCurrency = accounts.reduce((acc, account) => {
      const currency = account.currency
      if (!acc[currency]) {
         acc[currency] = 0
      }
      acc[currency] += account.value
      return acc
   }, {})

   // Convert balancesByCurrency object to array of {currency, amount} objects
   const currencyTotals = Object.entries(balancesByCurrency).map(([currency, amount]) => ({
      currency,
      amount
   }))

   useEffect(() => {
      const getConvertedTotals = async () => {
         // Filter out currencies that match primary currency
         const currenciesToConvert = currencyTotals.filter(
            ({ currency }) => currency !== userPreferences.primaryCurrency
         )
         // Handle primary currency separately
         const primaryCurrencyTotals = currencyTotals
            .filter(({ currency }) => currency === userPreferences.primaryCurrency)
            .map(({ currency, amount }) => ({
               currency,
               amount,
               convertedAmount: amount,
               exchangeRate: 1
            }))

         // Make a single API call for all currencies that need conversion
         try {
            const exchangeRatePromises = currenciesToConvert.map(({ currency }) =>
               axios.get(`/api/finance/exchange-rates?fromCurrency=${currency}&toCurrency=${userPreferences.primaryCurrency}`)
            )

            const exchangeRateResponses = await Promise.all(exchangeRatePromises)

            const convertedCurrencyTotals = currenciesToConvert.map((currencyTotal, index) => {
               const exchangeRate = exchangeRateResponses[index].data.exchangeRate
               return {
                  currency: currencyTotal.currency,
                  amount: currencyTotal.amount,
                  convertedAmount: currencyTotal.amount * exchangeRate,
                  exchangeRate
               }
            })

            setConvertedTotals([...primaryCurrencyTotals, ...convertedCurrencyTotals])

         } catch (error) {
            // Handle error case by setting exchange rate to -1
            const errorTotals = currenciesToConvert.map(currencyTotal => ({
               currency: currencyTotal.currency,
               amount: currencyTotal.amount,
               convertedAmount: currencyTotal.amount,
               exchangeRate: -1
            }))
            setConvertedTotals([...primaryCurrencyTotals, ...errorTotals])
         }
      }

      if (accounts.length > 0) {
         getConvertedTotals()
      }
   }, [accounts, userPreferences.primaryCurrency])

   const containerVariants = {
      hidden: { opacity: 0 },
      visible: {
         opacity: 1,
         transition: {
            staggerChildren: 0.1,
         },
      },
   }

   const itemVariants = {
      hidden: { opacity: 0, y: 20 },
      visible: {
         opacity: 1,
         y: 0,
         transition: { duration: 0.3 },
      },
   }
   
   // Check if any setup sections are missing
   const isConfigurationComplete = accounts.length > 0 && categories.length > 0
   
   return (
      <div>
         <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
         >
            <motion.div
               className="mx-auto w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-6"
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 10,
                  delay: 0.2,
               }}
            >
               <CheckCircle2 className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </motion.div>
            <h2 className="text-2xl font-semibold mb-3 text-blue-600 dark:text-blue-400">
               {t("completion.title")}
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4 max-w-lg mx-auto">
               {t("completion.desc")}
            </p>
            
            {!isConfigurationComplete && (
               <Alert variant="warning" className="mb-6 mx-auto max-w-lg">
                  <HelpCircle className="h-4 w-4" />
                  <AlertTitle>{t("completion.missingSetupTitle", "Some setup items are missing")}</AlertTitle>
                  <AlertDescription>
                     {t("completion.missingSetupDesc", "You can still continue, but for a better experience we recommend setting up your accounts and categories.")}
                  </AlertDescription>
               </Alert>
            )}
         </motion.div>

         <motion.div className="space-y-4 pt-4" variants={containerVariants} initial="hidden" animate="visible">
            <motion.div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors" variants={itemVariants}>
               <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
                  <Globe className="h-5 w-5 text-blue-500" />
                  {t("completion.basicInformation")}
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                     <DollarSign className="h-4 w-4" />
                     {t("completion.primaryCurrency")}:
                  </div>
                  <div className="font-medium">{userPreferences.primaryCurrency}</div>
                  <div className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                     <Calendar className="h-4 w-4" />
                     {t("completion.dateFormat")}:
                  </div>
                  <div className="font-medium">{userPreferences.dateFormat}</div>
               </div>
            </motion.div>

            <motion.div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors" variants={itemVariants}>
               <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
                  <Wallet className="h-5 w-5 text-blue-500" />
                  {t("completion.accounts")} ({accounts.length})
               </h3>
               {accounts.length > 0 ? (
                  <div className="space-y-4">
                     {isClient ? (
                        <>
                           {convertedTotals.length > 0 ? (
                              <div className="space-y-3 text-sm border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                                 {convertedTotals.map(({ currency, amount, convertedAmount, exchangeRate }) => (
                                    <div key={currency} className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
                                       <div className="text-gray-500 dark:text-gray-400 truncate">
                                          {currency} {t("common.balance")}:
                                       </div>
                                       <div className="md:text-right font-medium">
                                          {formatCurrency(amount, currency, i18n.language)}
                                          {currency !== userPreferences.primaryCurrency && (
                                             <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 block md:inline">
                                                (
                                                {!exchangeRate || exchangeRate === -1
                                                   ? <span className="text-red-500">{t("completion.exchangeRateUnavailable")}</span>
                                                   : `~${formatCurrency(convertedAmount, userPreferences.primaryCurrency, i18n.language)} @ ${exchangeRate.toFixed(4)}`
                                                }
                                                )
                                             </span>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           ) : (
                              <div className="space-y-3 text-sm border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                                 <Skeleton className="h-5 w-full" />
                                 <Skeleton className="h-5 w-2/3" />
                              </div>
                           )}
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 text-sm">
                              <div className="text-gray-700 dark:text-gray-300 font-medium">{t("common.totalBalance")} ({userPreferences.primaryCurrency}):</div>
                              <div className="md:text-right text-blue-600 dark:text-blue-400 font-semibold text-base">
                                 {formatCurrency(
                                    convertedTotals.reduce((sum, item) => sum + (item.convertedAmount || 0), 0),
                                    userPreferences.primaryCurrency || 'USD',
                                    i18n.language || 'en'
                                 )}
                              </div>
                           </div>
                        </>
                     ) : (
                        <>
                           <div className="space-y-3 text-sm border-b border-gray-100 dark:border-gray-700 pb-4 mb-4">
                              <Skeleton className="h-5 w-full" />
                              <Skeleton className="h-5 w-2/3" />
                           </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 text-sm">
                               <div className="text-gray-700 dark:text-gray-300 font-medium">{t("common.totalBalance")} ({userPreferences.primaryCurrency}):</div>
                               <div className="md:text-right text-blue-600 dark:text-blue-400">
                                  <Skeleton className="h-6 w-24 inline-block" />
                               </div>
                            </div>
                        </>
                     )}
                     <div className="text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-1">
                           <CheckIcon className="h-4 w-4 text-green-500" />
                           {t("completion.accountsAdded", { count: accounts.length })}
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center py-6">
                     <p className="mb-2">{t("completion.noAccountsAdded")}</p>
                     <Button
                        variant="outline" 
                        size="sm"
                        onClick={() => onBack()}
                        className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                     >
                        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                        {t("completion.goBackToAdd", "Go back to add")}
                     </Button>
                  </div>
               )}
            </motion.div>

            <motion.div className="bg-white dark:bg-gray-800 p-5 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 transition-colors" variants={itemVariants}>
               <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
                  <Tag className="h-5 w-5 text-blue-500" />
                  {t("completion.categories")} ({categories.length})
               </h3>
               {categories.length > 0 ? (
                  <div className="space-y-4">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                           <ArrowRight className="h-4 w-4 text-blue-500" />
                           {t("common.incomeCategories")}:
                        </div>
                        <div className="font-medium">{categories.filter((c) => c.type === "income").length}</div>
                        <div className="text-gray-500 dark:text-gray-400 flex items-center gap-2">
                           <ArrowRight className="h-4 w-4 text-red-500" />
                           {t("common.expenseCategories")}:
                        </div>
                        <div className="font-medium">{categories.filter((c) => c.type === "expense").length}</div>
                     </div>
                     <div className="text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex items-center gap-1">
                           <CheckIcon className="h-4 w-4 text-green-500" />
                           {t("completion.categoriesReady")}
                        </div>
                     </div>
                  </div>
               ) : (
                  <div className="text-sm text-gray-500 dark:text-gray-400 flex flex-col items-center py-6">
                     <p className="mb-2">{t("completion.noCategoriesAdded")}</p>
                     <Button
                        variant="outline" 
                        size="sm"
                        onClick={() => onBack()}
                        className="text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                     >
                        <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                        {t("completion.goBackToAdd", "Go back to add")}
                     </Button>
                  </div>
               )}
            </motion.div>
            
            <motion.div 
               className="bg-blue-50 dark:bg-blue-900/20 p-5 rounded-lg border border-blue-100 dark:border-blue-900/50 mt-6"
               variants={itemVariants}
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.4 }}
            >
               <div className="flex flex-col md:flex-row items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                     <Sparkles className="h-5 w-5 text-blue-500" />
                     <p className="font-medium text-blue-700 dark:text-blue-300">
                        {t("completion.readyToStart", "Ready to start your financial journey?")}
                     </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                     <Button
                        variant="outline" 
                        onClick={onBack}
                        className="border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                     >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        {t("common.back")}
                     </Button>
                     <Button 
                        onClick={onComplete} 
                        disabled={isSubmitting}
                        className="bg-blue-600 hover:bg-blue-700 text-white flex-1 sm:flex-auto"
                        size="lg"
                     >
                        {isSubmitting ? (
                           <div className="flex items-center gap-2">
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              {t("common.saving")}
                           </div>
                        ) : (
                           <div className="flex items-center gap-2">
                              {t("completion.finishSetup")}
                              <ArrowRight className="h-4 w-4" />
                           </div>
                        )}
                     </Button>
                  </div>
               </div>
            </motion.div>
         </motion.div>
      </div>
   )
}