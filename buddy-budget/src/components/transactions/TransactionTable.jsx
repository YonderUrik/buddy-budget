'use client'

import { useTranslation } from "react-i18next";
import TransactionGroup from "./TransactionGroup";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useTransactions } from "@/providers/transactions-provider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export default function TransactionTable({ transactions, totalDays, totalPages, daysOnThisPage }) {
  console.log("totalDays", totalDays);
  const { t } = useTranslation();
  const { page, setPage, daysPerPage, setDaysPerPage, isLoading } = useTransactions();
  
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage > 0 && newPage <= totalPages) {
      setPage(newPage);
      // Scroll to top of the transaction list
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getPageNumbers = () => {
    const isMobile = windowWidth < 640;
    const maxButtons = isMobile ? 3 : 5;
    
    if (totalPages <= maxButtons) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    // Always show first, last, current page and some neighbors
    let pages = [1];
    
    let startPage = Math.max(2, page - Math.floor((maxButtons - 3) / 2));
    let endPage = Math.min(totalPages - 1, startPage + maxButtons - 4);
    
    if (endPage - startPage < maxButtons - 4) {
      startPage = Math.max(2, endPage - (maxButtons - 4));
    }
    
    // Add ellipsis if needed
    if (startPage > 2) {
      pages.push('...');
    }
    
    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    // Add ellipsis if needed
    if (endPage < totalPages - 1) {
      pages.push('...');
    }
    
    // Add last page
    if (totalPages > 1) {
      pages.push(totalPages);
    }
    
    return pages;
  };

  if (!transactions || transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <AlertCircle className="h-12 w-12 text-gray-400 dark:text-gray-600 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">{t("transactions.noTransactions")}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">{t("transactions.noTransactionsDesc")}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-hidden">
        {/* Table Header */}
        <div className="hidden md:grid grid-cols-12 gap-x-6 px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700 rounded-t-lg mb-4">
          <div className="col-span-4">{t("transactions.fields.transaction")}</div>
          <div className="col-span-2">{t("transactions.fields.category")}</div>
          <div className="col-span-3">{t("transactions.fields.account")}</div>
          <div className="col-span-2 text-right">{t("transactions.fields.amount")}</div>
        </div>

        {/* Transaction Groups */}
        <div className="space-y-4">
          {transactions.map((transaction) => (
            <TransactionGroup key={transaction.date} date={transaction.date} transactions={transaction.transactionList} />
          ))}
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="mt-8 flex flex-col sm:flex-row items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-4 sm:mb-0">
          <span className="text-sm text-gray-700 dark:text-gray-300 mr-4">
            {t("transactions.showing")} {(page - 1) * daysPerPage + 1}-{Math.min(page * daysPerPage, totalDays)} {t("transactions.of")} {totalDays} {t("transactions.days")}
          </span>
          <div className="flex items-center">
            <span className="text-sm text-gray-700 dark:text-gray-300 mr-2">{t("transactions.daysPerPage")}</span>
            <Select 
              value={daysPerPage.toString()} 
              onValueChange={(value) => {
                setDaysPerPage(parseInt(value));
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[70px] h-8 focus-visible:ring-blue-500/50">
                <SelectValue placeholder={daysPerPage} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-center sm:justify-end">
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || isLoading}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 text-sm font-medium"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            {getPageNumbers().map((pageNum, index) => (
              pageNum === '...' ? (
                <span 
                  key={`ellipsis-${index}`}
                  className="relative inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-400"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </span>
              ) : (
                <Button
                  key={`page-${pageNum}`}
                  variant={pageNum === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                  disabled={isLoading}
                  className={`relative inline-flex items-center px-3 py-2 text-sm font-medium ${
                    pageNum === page
                      ? "bg-blue-600 dark:bg-blue-700 text-white"
                      : "text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {pageNum}
                </Button>
              )
            ))}
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages || isLoading}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 text-sm font-medium"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
} 