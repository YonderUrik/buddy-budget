"use client"

import { Button } from "@/components/ui/button"
import { CheckCircle2, ArrowLeft, ArrowRight, Globe, DollarSign, Calendar, Wallet, Tag } from "lucide-react"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { config, formatCurrency } from "@/lib/config"
import yahooFinance from 'yahoo-finance2';
import { useEffect, useState } from "react"
import axios from "axios"
import { Skeleton } from "@/components/ui/skeleton"

export function CompletionStep({ userPreferences, accounts, categories, onComplete, onBack, isSubmitting }) {
   const { t, i18n } = useTranslation()
   const [convertedTotals, setConvertedTotals] = useState([])
   const [isClient, setIsClient] = useState(false)

   useEffect(() => {
      setIsClient(true)
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

      getConvertedTotals()
   }, [])

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

   return (
      <div>
         <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="text-center"
         >
            <motion.div
               className="mx-auto w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4"
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 10,
                  delay: 0.2,
               }}
            >
               <CheckCircle2 className="h-10 w-10 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-semibold mb-2">
               {t("completion.title")}
            </h2>
            <p className="text-muted-foreground mb-8">
               {t("completion.desc")}
            </p>
         </motion.div>

         <motion.div className="space-y-4 pt-4" variants={containerVariants} initial="hidden" animate="visible">
            <motion.div className="bg-muted p-5 rounded-lg border" variants={itemVariants}>
               <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-primary" />
                  {t("completion.basicInformation")}
               </h3>
               <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-muted-foreground flex items-center gap-2">
                     <DollarSign className="h-3 w-3" />
                     {t("completion.primaryCurrency")}:
                  </div>
                  <div>{userPreferences.primaryCurrency}</div>
                  <div className="text-muted-foreground flex items-center gap-2">
                     <Calendar className="h-3 w-3" />
                     {t("completion.dateFormat")}:
                  </div>
                  <div>{userPreferences.dateFormat}</div>
               </div>
            </motion.div>

            <motion.div className="bg-muted p-5 rounded-lg border" variants={itemVariants}>
               <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  {t("completion.accounts")} ({accounts.length})
               </h3>
               {accounts.length > 0 ? (
                  <div className="space-y-3">
                     {isClient ? (
                        <>
                           {convertedTotals.length > 0 ? (
                              <div className="space-y-2 text-sm border-b pb-3 mb-3">
                                 {convertedTotals.map(({ currency, amount, convertedAmount, exchangeRate }) => (
                                    <div key={currency} className="grid grid-cols-2 gap-x-3">
                                       <div className="text-muted-foreground truncate">
                                          {currency} {t("common.balance")}:
                                       </div>
                                       <div className="text-right font-medium">
                                          {formatCurrency(amount, currency, i18n.language)}
                                          {currency !== userPreferences.primaryCurrency && (
                                             <span className="text-xs text-muted-foreground ml-1">
                                                (
                                                {exchangeRate === -1
                                                   ? "N/A"
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
                              <div className="space-y-2 text-sm border-b pb-3 mb-3">
                                 <Skeleton className="h-4 w-full" />
                                 <Skeleton className="h-4 w-2/3" />
                              </div>
                           )}
                           <div className="grid grid-cols-2 gap-x-3 text-sm font-medium">
                              <div className="text-muted-foreground">{t("common.totalBalance")} ({userPreferences.primaryCurrency}):</div>
                              <div className="text-right text-primary">
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
                           <div className="space-y-2 text-sm border-b pb-3 mb-3">
                              <Skeleton className="h-4 w-full" />
                              <Skeleton className="h-4 w-2/3" />
                           </div>
                            <div className="grid grid-cols-2 gap-x-3 text-sm font-medium">
                               <div className="text-muted-foreground">{t("common.totalBalance")} ({userPreferences.primaryCurrency}):</div>
                               <div className="text-right text-primary">
                                  <Skeleton className="h-5 w-20 inline-block" />
                               </div>
                            </div>
                        </>
                     )}
                     <div className="text-sm text-muted-foreground pt-3 border-t">
                        {t("completion.accountsAdded", { count: accounts.length })}
                     </div>
                  </div>
               ) : (
                  <p className="text-sm text-muted-foreground">{t("completion.noAccountsAdded")}</p>
               )}
            </motion.div>

            <motion.div className="bg-muted p-5 rounded-lg border" variants={itemVariants}>
               <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Tag className="h-4 w-4 text-primary" />
                  {t("completion.categories")} ({categories.length})
               </h3>
               {categories.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 text-sm">
                     <div className="text-muted-foreground flex items-center gap-2">
                        <ArrowRight className="h-3 w-3 text-primary" />
                        {t("common.incomeCategories")}:
                     </div>
                     <div>{categories.filter((c) => c.type === "income").length}</div>
                     <div className="text-muted-foreground flex items-center gap-2">
                        <ArrowRight className="h-3 w-3 text-destructive" />
                        {t("common.expenseCategories")}:
                     </div>
                     <div>{categories.filter((c) => c.type === "expense").length}</div>
                  </div>
               ) : (
                  <p className="text-sm text-muted-foreground">{t("completion.noCategoriesAdded")}</p>
               )}
            </motion.div>
         </motion.div>

         <motion.div
            className="flex justify-between pt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.3 }}
         >
            <Button disabled={isSubmitting} variant="outline" onClick={onBack} className="flex items-center gap-2">
               <ArrowLeft className="h-4 w-4" />
               {t('common.back')}
            </Button>
            <Button disabled={isSubmitting} onClick={onComplete}>
               {t('common.startUsing')} {config.appName}
            </Button>
         </motion.div>
      </div>
   )
}
