"use client"

import { motion } from "framer-motion"
import { 
  DollarSign, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ArrowLeftRight, 
  Calendar, 
  FileText, 
  Repeat, 
  ListChecks, 
  HelpCircle 
} from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"

export function TransactionGuide() {
  const { t } = useTranslation()
  
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
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Main Explanation */}
      <Card className="border-blue-100 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/20 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-blue-500" />
            {t("onboarding.transactionBasics")}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 dark:text-gray-300">
          <p>
            {t("onboarding.transactionBasicsDesc")}
          </p>
        </CardContent>
      </Card>

      {/* Transaction Types */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-100 dark:border-green-900/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ArrowDownLeft className="h-4 w-4 text-green-500" />
              <span className="text-green-600 dark:text-green-400">{t("common.income")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 dark:text-gray-300">
            <p>{t("onboarding.incomeDesc")}</p>
          </CardContent>
        </Card>

        <Card className="border-red-100 dark:border-red-900/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-red-500" />
              <span className="text-red-600 dark:text-red-400">{t("common.expense")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 dark:text-gray-300">
            <p>{t("onboarding.expenseDesc")}</p>
          </CardContent>
        </Card>

        <Card className="border-purple-100 dark:border-purple-900/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-purple-500" />
              <span className="text-purple-600 dark:text-purple-400">{t("common.transfer")}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-600 dark:text-gray-300">
            <p>{t("onboarding.transferDesc")}</p>
          </CardContent>
        </Card>
      </motion.div>

      {/* How to Add Transactions */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
          <FileText className="h-5 w-5 text-blue-500" />
          {t("onboarding.howToAddTransactions")}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {t("onboarding.howToAddTransactionsDesc")}
        </p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Badge variant="outline" className="mb-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">1</Badge>
            <span className="text-xs text-center text-gray-600 dark:text-gray-300">{t("common.selectCategory")}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Badge variant="outline" className="mb-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">2</Badge>
            <span className="text-xs text-center text-gray-600 dark:text-gray-300">{t("common.selectAccount")}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Badge variant="outline" className="mb-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">3</Badge>
            <span className="text-xs text-center text-gray-600 dark:text-gray-300">{t("common.enterAmount")}</span>
          </div>
          <div className="flex flex-col items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <Badge variant="outline" className="mb-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800">4</Badge>
            <span className="text-xs text-center text-gray-600 dark:text-gray-300">{t("common.selectDate")}</span>
          </div>
        </div>
      </motion.div>

      {/* Tips for effective tracking */}
      <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-100 dark:border-gray-700">
        <h3 className="font-semibold mb-4 flex items-center gap-2 text-lg">
          <ListChecks className="h-5 w-5 text-blue-500" />
          {t("onboarding.transactionTipsTitle")}
        </h3>
        
        <ul className="space-y-3 text-sm">
          <li className="flex items-start gap-2">
            <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full text-green-600 dark:text-green-400">
              <CheckmarkIcon className="h-3 w-3" />
            </div>
            <span className="text-gray-600 dark:text-gray-300">{t("onboarding.transactionTips1")}</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full text-green-600 dark:text-green-400">
              <CheckmarkIcon className="h-3 w-3" />
            </div>
            <span className="text-gray-600 dark:text-gray-300">{t("onboarding.transactionTips2")}</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full text-green-600 dark:text-green-400">
              <CheckmarkIcon className="h-3 w-3" />
            </div>
            <span className="text-gray-600 dark:text-gray-300">{t("onboarding.transactionTips3")}</span>
          </li>
          <li className="flex items-start gap-2">
            <div className="mt-1 bg-green-100 dark:bg-green-900/30 p-1 rounded-full text-green-600 dark:text-green-400">
              <CheckmarkIcon className="h-3 w-3" />
            </div>
            <span className="text-gray-600 dark:text-gray-300">{t("onboarding.transactionTips4")}</span>
          </li>
        </ul>
      </motion.div>

      {/* Ready to start */}
      <motion.div variants={itemVariants} className="p-5 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-100 dark:border-blue-900/50">
        <div className="flex items-center gap-2 mb-2">
          <Repeat className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <h3 className="font-semibold text-lg text-blue-700 dark:text-blue-300">{t("onboarding.readyForTransactions")}</h3>
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          {t("onboarding.readyForTransactionsDesc")}
        </p>
      </motion.div>
    </motion.div>
  )
}

// Simple checkmark icon component
function CheckmarkIcon({ className }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="3" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  )
} 