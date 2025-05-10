import { ArrowRight, ArrowRightLeft, MoreHorizontal } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { getIconComponent } from "@/app/dashboard/transactions/page";
import { accountIcons, categoryIcons, formatCurrency } from '@/lib/config';
import { useSession } from "next-auth/react";
import { useTranslation } from "react-i18next";

const CategoryBadge = ({ category }) => {
  if (!category) {
    return null; // Don't render badge if no category (e.g., for transfers)
  }

  return (
    <div
      className="h-6 rounded-full flex items-center justify-center px-2 text-xs md:text-sm whitespace-nowrap overflow-hidden"
      style={{
        backgroundColor: category.color + "20",
        color: category.color
      }}
    >
      <span className="mr-1">{getIconComponent(categoryIcons, category.icon)}</span>
      <span className="truncate">{category.name}</span>
    </div>
  );
};

export default function TransactionRow({ transaction }) {
  const { data: session } = useSession()
  const { t, i18n } = useTranslation()
  const { amount, category, convertedSourceAmount, convertedDestinationAmount, date, description, destinationAccount, sourceAccount, type } = transaction;

  return (
    <div className="grid grid-cols-12 gap-x-2 md:gap-x-6 px-3 md:px-4 py-3 md:py-4 items-center border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      {/* Mobile Layout - Stacked for better readability on small screens */}
      <div className="col-span-12 md:hidden">
        <div className="flex items-center justify-between mb-2">
          {/* Transaction Icon and Description */}
          <div className="flex items-center">
            <div className="flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center mr-2"
              style={{
                backgroundColor: type === 'income' ? 'var(--success-color, #10b981)' + '20' :
                  type === 'expense' ? 'var(--destructive-color, #ef4444)' + '20' :
                    'var(--primary-color, #3b82f6)' + '20',
                color: type === 'income' ? 'var(--success-color, #10b981)' :
                  type === 'expense' ? 'var(--destructive-color, #ef4444)' :
                    'var(--primary-color, #3b82f6)'
              }}
            >
              {type === 'income' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              ) : type === 'expense' ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12l7 7 7-7" />
                </svg>
              ) : (
                <ArrowRightLeft className="h-4 w-4" />
              )}
            </div>
            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate max-w-[150px]">
              {description}
            </div>
          </div>

          {/* Amount */}
          <div className={`text-right font-medium`}>
            <div className={`${type === 'income' ? 'text-green-600 dark:text-green-400' : type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {type === 'income'
                ? `+${formatCurrency(amount, sourceAccount?.currency, i18n.language)}`
                : type === 'expense'
                  ? `-${formatCurrency(Math.abs(amount), sourceAccount?.currency, i18n.language)}`
                  : `${formatCurrency(amount, sourceAccount?.currency, i18n.language)}`}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          {/* Category */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {category ? <CategoryBadge category={category} /> : <span className="text-gray-400 dark:text-gray-500">-</span>}
          </div>

          {/* Account */}
          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
            {type === 'transfer' ? (
              <div className="flex items-center">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center mr-1"
                  style={{ backgroundColor: sourceAccount?.color + "20", color: sourceAccount?.color }}
                >
                  {getIconComponent(accountIcons, sourceAccount?.icon)}
                </div>
                <ArrowRight className="h-3 w-3 text-gray-400 dark:text-gray-500 mx-1" />
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: destinationAccount?.color + "20", color: destinationAccount?.color }}
                >
                  {getIconComponent(accountIcons, destinationAccount?.icon)}
                </div>
              </div>
            ) : (
              <div className="flex items-center">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center mr-1"
                  style={{ backgroundColor: sourceAccount?.color + "20", color: sourceAccount?.color }}
                >
                  {getIconComponent(accountIcons, sourceAccount?.icon)}
                </div>
                <span className="truncate max-w-[80px]" title={sourceAccount?.name}>
                  {sourceAccount?.name}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Layout - Grid */}
      <div className="hidden md:flex col-span-4 items-center">
        <div className="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center mr-3"
          style={{
            backgroundColor: type === 'income' ? 'var(--success-color, #10b981)' + '20' :
              type === 'expense' ? 'var(--destructive-color, #ef4444)' + '20' :
                'var(--primary-color, #3b82f6)' + '20',
            color: type === 'income' ? 'var(--success-color, #10b981)' :
              type === 'expense' ? 'var(--destructive-color, #ef4444)' :
                'var(--primary-color, #3b82f6)'
          }}
        >
          {type === 'income' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          ) : type === 'expense' ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          ) : (
            <ArrowRightLeft className="h-5 w-5" />
          )}
        </div>
        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
          {description}
        </div>
      </div>

      <div className="hidden md:block col-span-2 text-sm text-gray-500 dark:text-gray-400 overflow-hidden">
        {category ? <CategoryBadge category={category} /> : <span className="text-gray-400 dark:text-gray-500">-</span>}
      </div>

      <div className="hidden md:flex col-span-3 items-center text-sm text-gray-500 dark:text-gray-400 overflow-hidden">
        {type === 'transfer' ? (
          <div className="flex items-center overflow-hidden">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center mr-1 flex-shrink-0"
              style={{ backgroundColor: sourceAccount?.color + "20", color: sourceAccount?.color }}
            >
              {getIconComponent(accountIcons, sourceAccount?.icon)}
            </div>
            <span className="truncate max-w-[60px] lg:max-w-[100px]" title={sourceAccount?.name}>
              {sourceAccount?.name}
            </span>
            <ArrowRight className="h-3 w-3 text-gray-400 dark:text-gray-500 mx-1 flex-shrink-0" />
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center mr-1 flex-shrink-0"
              style={{ backgroundColor: destinationAccount?.color + "20", color: destinationAccount?.color }}
            >
              {getIconComponent(accountIcons, destinationAccount?.icon)}
            </div>
            <span className="truncate max-w-[60px] lg:max-w-[100px]" title={destinationAccount?.name}>
              {destinationAccount?.name}
            </span>
          </div>
        ) : (
          <div className="flex items-center overflow-hidden">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center mr-1 flex-shrink-0"
              style={{ backgroundColor: sourceAccount?.color + "20", color: sourceAccount?.color }}
            >
              {getIconComponent(accountIcons, sourceAccount?.icon)}
            </div>
            <span className="truncate" title={sourceAccount?.name}>
              {sourceAccount?.name}
            </span>
          </div>
        )}
      </div>

      <div className="hidden md:block col-span-2 text-sm text-right font-medium ml-auto">
        <div className={`${type === 'income' ? 'text-green-600 dark:text-green-400' : type === 'expense' ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}`}>
          {type === 'income'
            ? `+${formatCurrency(amount, sourceAccount?.currency, i18n.language)}`
            : type === 'expense'
              ? `-${formatCurrency(Math.abs(amount), sourceAccount?.currency, i18n.language)}`
              : `${formatCurrency(amount, sourceAccount?.currency, i18n.language)}`}
        </div>

        {sourceAccount?.currency !== session?.user?.primaryCurrency && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {type === 'income'
              ? `+${formatCurrency(convertedSourceAmount, session?.user?.primaryCurrency, i18n.language)}`
              : type === 'expense'
                ? `-${formatCurrency(Math.abs(convertedSourceAmount), session?.user?.primaryCurrency, i18n.language)}`
                : `${formatCurrency(convertedSourceAmount, session?.user?.primaryCurrency, i18n.language)}`}
          </div>
        )}
      </div>
    </div>
  );
} 