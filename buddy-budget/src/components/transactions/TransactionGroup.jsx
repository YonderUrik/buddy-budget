'use client'

import TransactionRow from "./TransactionRow";
import { format, parseISO } from 'date-fns';
import { Checkbox } from "@/components/ui/checkbox";
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";
import { formatCurrency, formatDate } from "@/lib/config";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function TransactionGroup({ date, transactions }) {
  const { data: session } = useSession()
  const { t, i18n } = useTranslation()
  const [isCollapsed, setIsCollapsed] = useState(false);

  const dateFormat = session?.user?.dateFormat
  const groupTotal = transactions.reduce((sum, t) => {
    if (t.type === 'expense') {
      return sum - t.convertedSourceAmount;
    } else if (t.type === 'income') {
      return sum + t.convertedSourceAmount;
    } else if (t.type === 'transfer') {
      return sum - t.convertedSourceAmount + t.convertedDestinationAmount;
    }
    return sum;
  }, 0);

  return (
    <div className="mb-4 border rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
      {/* Date Header */}
      <button 
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="w-full text-left bg-gray-100 dark:bg-gray-800 px-3 md:px-4 py-3 sticky top-0 z-10 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-750 transition-colors cursor-pointer"
      >
        <div className="grid grid-cols-12 gap-x-2 md:gap-x-6 items-center">
          <div className="col-span-8 md:col-span-9 text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
            {isCollapsed ? 
              <ChevronDown className="h-4 w-4 mr-1 flex-shrink-0 text-gray-500 dark:text-gray-400" /> : 
              <ChevronUp className="h-4 w-4 mr-1 flex-shrink-0 text-gray-500 dark:text-gray-400" />
            }
            <span className="text-sm md:text-base font-semibold">{formatDate(new Date(date), dateFormat, i18n.language)}</span> 
            <span className="text-gray-500 dark:text-gray-400 font-normal ml-2 text-xs">
              · {transactions.length} {transactions.length === 1 ? t("transactions.transaction") : t("transactions.transactions")}
            </span>
          </div>
          <div className="col-span-4 md:col-span-3 text-xs md:text-sm text-right">
            <div className={`font-medium ${groupTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {groupTotal >= 0 
                ? `+${formatCurrency(groupTotal, session?.user?.primaryCurrency, i18n.language)}` 
                : `${formatCurrency(groupTotal, session?.user?.primaryCurrency, i18n.language)}`
              }
            </div>
          </div>
        </div>
      </button>

      {/* Transaction Rows */}
      <AnimatePresence>
        {!isCollapsed && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="divide-y divide-gray-200 dark:divide-gray-700 overflow-hidden"
          >
            {transactions.map((transaction) => (
              <TransactionRow key={transaction.id} transaction={transaction} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
} 