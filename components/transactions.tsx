'use client';

import { useState, useEffect } from 'react';
import { Dictionary } from "@/types/dictionary";
import {
   Card,
   CardBody,
   CardHeader,
   Button,
   Chip,
   Spinner,
   Divider,
   Avatar,
   Input,
   Select,
   SelectItem,
   DateRangePicker,
   useDisclosure
   , Drawer, DrawerContent, DrawerHeader, DrawerBody
} from "@heroui/react";
import { Icon } from "@iconify/react";
import clsx from "clsx";
import { today, getLocalTimeZone } from "@internationalized/date";
import { I18nProvider } from "@react-aria/i18n";
import AddTransaction from "./add-transaction";

interface Transaction {
   id: string;
   amount: number;
   currency: string;
   description?: string;
   date: string;
   merchantName?: string;
   provider?: string;
   account: {
      id: string;
      name: string;
      type: string;
      institutionName?: string;
   };
   category?: {
      id: string;
      name: string;
      icon: string;
      color: string;
      type: string;
   } | null;
}

interface TransactionResponse {
   data: Transaction[];
   pagination: {
      skip: number;
      limit: number;
      totalCount: number;
      hasMore: boolean;
      totalPages: number;
      currentPage: number;
   };
}

interface DateRange {
   start: Date;
   end: Date;
}

interface Filters {
   dateRange?: DateRange;
   type?: 'all' | 'income' | 'expense' | 'transfer';
   search?: string;
   accountId?: string;
}

interface Account {
   id: string;
   name: string;
   type: string;
   institutionName?: string;
}

export const transactionTypes = [
   {
      value: 'all',
      label: 'All Types',
      icon: 'mdi:wallet-outline',
      color: 'gray'
   },
   {
      value: 'income',
      label: 'Income',
      icon: 'mdi:arrow-up',
      color: 'success'
   },

   {
      value: 'expense',
      label: 'Expense',
      icon: 'mdi:arrow-down',
      color: 'danger'
   },

   {
      value: 'transfer',
      label: 'Transfer',
      icon: 'mdi:swap-horizontal',
      color: 'warning'
   },
];

export default function Transactions({ dict }: { dict?: Dictionary }) {
   const [transactions, setTransactions] = useState<Transaction[]>([]);
   const [loading, setLoading] = useState(false);
   const [error, setError] = useState<string | null>(null);
   const [pagination, setPagination] = useState({
      skip: 0,
      limit: 20,
      totalCount: 0,
      hasMore: false,
      currentPage: 1
   });
   const [filters, setFilters] = useState<Filters>({
      type: 'all',
      accountId: 'all'
   });
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedDateRange, setSelectedDateRange] = useState<any>(null);
   const [accounts, setAccounts] = useState<Account[]>([]);
   const { isOpen, onOpen, onOpenChange } = useDisclosure();

   const fetchTransactions = async (skip = 0, limit = 20, currentFilters = filters) => {
      setLoading(true);
      setError(null);

      try {
         const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString()
         });

         // Add filter parameters
         if (currentFilters.dateRange) {
            params.append('startDate', currentFilters.dateRange.start.toISOString());
            params.append('endDate', currentFilters.dateRange.end.toISOString());
         }
         if (currentFilters.type && currentFilters.type !== 'all') {
            params.append('type', currentFilters.type);
         }
         if (currentFilters.search && currentFilters.search.trim()) {
            params.append('search', currentFilters.search.trim());
         }
         if (currentFilters.accountId) {
            params.append('accountId', currentFilters.accountId);
         }

         const response = await fetch(`/api/transactions?${params}`);

         if (!response.ok) {
            throw new Error('Failed to fetch transactions');
         }

         const data: TransactionResponse = await response.json();

         if (skip === 0) {
            setTransactions(data.data);
         } else {
            setTransactions(prev => [...prev, ...data.data]);
         }

         setPagination(data.pagination);
      } catch (err) {
         setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      fetchTransactions();
      fetchAccounts();
   }, []);

   const fetchAccounts = async () => {
      try {
         const response = await fetch('/api/accounts?includeTransactions=false');
         if (response.ok) {
            const accountsData = await response.json();
            setAccounts(accountsData || []);
         }
      } catch (error) {
         console.error('Failed to fetch accounts:', error);
      }
   };

   useEffect(() => {
      fetchTransactions(0, 20, filters);
   }, [filters]);

   const loadMore = () => {
      if (pagination.hasMore && !loading) {
         fetchTransactions(pagination.skip + pagination.limit, pagination.limit, filters);
      }
   };

   const getDateRangePreset = (preset: 'week' | 'month' | 'year') => {
      const todayDate = today(getLocalTimeZone());
      let startDate;

      switch (preset) {
         case 'week':
            startDate = todayDate.subtract({ days: 7 });
            break;
         case 'month':
            startDate = todayDate.subtract({ months: 1 });
            break;
         case 'year':
            startDate = todayDate.subtract({ years: 1 });
            break;
      }

      return {
         start: startDate,
         end: todayDate,
         // Also return JavaScript dates for API calls
         startJs: new Date(startDate.year, startDate.month - 1, startDate.day),
         endJs: new Date(todayDate.year, todayDate.month - 1, todayDate.day)
      };
   };

   const applyDateRangePreset = (preset: 'week' | 'month' | 'year') => {
      const dateRange = getDateRangePreset(preset);
      setFilters(prev => ({
         ...prev,
         dateRange: {
            start: dateRange.startJs,
            end: dateRange.endJs
         }
      }));
      setSelectedDateRange({
         start: dateRange.start,
         end: dateRange.end
      });
   };

   const clearDateRange = () => {
      setFilters(prev => ({ ...prev, dateRange: undefined }));
      setSelectedDateRange(null);
   };

   // Debounce search term updates
   useEffect(() => {
      const timeoutId = setTimeout(() => {
         setFilters(prev => ({ ...prev, search: searchTerm || undefined }));
      }, 500);

      return () => clearTimeout(timeoutId);
   }, [searchTerm]);

   const handleSearchChange = (value: string) => {
      setSearchTerm(value);
   };

   const handleTypeChange = (value: string) => {
      setFilters(prev => ({ ...prev, type: value as 'all' | 'income' | 'expense' | 'transfer' }));
   };

   const handleDateRangeChange = (range: any) => {
      setSelectedDateRange(range);
      if (range?.start && range?.end) {
         // Convert CalendarDate to JavaScript Date for API calls
         const startJs = new Date(range.start.year, range.start.month - 1, range.start.day);
         const endJs = new Date(range.end.year, range.end.month - 1, range.end.day);

         setFilters(prev => ({
            ...prev,
            dateRange: {
               start: startJs,
               end: endJs
            }
         }));
      } else {
         setFilters(prev => ({ ...prev, dateRange: undefined }));
      }
   };

   const handleAccountChange = (value: string) => {
      setFilters(prev => ({
         ...prev,
         accountId: value
      }));
   };

   const formatAmount = (amount: number, currency: string) => {
      const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
      return new Intl.NumberFormat(locale, {
         style: 'currency',
         currency: currency || 'USD'
      }).format(amount);
   };

   const formatDateHeader = (dateString: string) => {
      const date = new Date(dateString);
      const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      return date.toLocaleDateString(locale, {
         year: 'numeric',
         month: 'long',
         day: 'numeric'
      });
   };

   const formatDateRange = (startDate: Date, endDate: Date) => {
      // Use browser locale for consistent date formatting
      const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
      const options: Intl.DateTimeFormatOptions = {
         year: 'numeric',
         month: 'short',
         day: 'numeric'
      };

      const start = startDate.toLocaleDateString(locale, options);
      const end = endDate.toLocaleDateString(locale, options);

      return `${start} - ${end}`;
   };

   const formatExactDate = (dateString: string) => {
      const date = new Date(dateString);
      const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
      // Use browser locale for time formatting
      return date.toLocaleTimeString(locale, {
         hour: '2-digit',
         minute: '2-digit',
         hour12: undefined // Let browser decide 12/24 hour format based on locale
      });
   };

   const groupTransactionsByDate = (transactions: Transaction[]) => {
      const grouped: { [key: string]: Transaction[] } = {};

      transactions.forEach(transaction => {
         const dateKey = new Date(transaction.date).toDateString();
         if (!grouped[dateKey]) {
            grouped[dateKey] = [];
         }
         grouped[dateKey].push(transaction);
      });

      return grouped;
   };

   const groupedTransactions = groupTransactionsByDate(transactions);
   const dateKeys = Object.keys(groupedTransactions).sort((a, b) =>
      new Date(b).getTime() - new Date(a).getTime()
   );

   const calculateDayTotal = (dayTransactions: Transaction[]) => {
      return dayTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
   };

   return (
      <div className="max-w-4xl mx-auto w-full p-2 sm:p-4">
         <div className="flex items-center justify-between mb-6">
            <h1 className="text-xl sm:text-2xl font-bold">Transactions</h1>
            <Button
               color="primary"
               onPress={onOpen}
               startContent={<Icon icon="mdi:plus" className="w-5 h-5" />}
            >
               Add Transaction
            </Button>

         </div>

         {/* Filters */}
         <Card className="mb-4 sm:mb-6">
            <CardBody className="gap-4">
               {/* Search */}
               <Input
                  placeholder="Search by merchant or description..."
                  value={searchTerm}
                  onValueChange={handleSearchChange}
                  startContent={<Icon icon="mdi:magnify" className="text-default-400" />}
                  isClearable={true}
                  onClear={() => {
                     setSearchTerm('');
                     setFilters(prev => ({ ...prev, search: undefined }));
                  }}
                  size="sm"
               />

               {/* Filters Grid */}
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select
                     label="Transaction Type"
                     selectedKeys={filters.type ? [filters.type] : []}
                     onSelectionChange={(keys) => {
                        const selectedKeys = Array.from(keys);
                        const value = selectedKeys[0] as string;
                        if (!value) {
                           setFilters(prev => ({ ...prev, type: 'all' }));
                           return;
                        }
                        handleTypeChange(value);
                     }}
                     size="sm"
                     className="w-full"
                     renderValue={() => {
                        const type = transactionTypes.find(t => t.value === filters.type);
                        return (
                           <span className="flex items-center gap-2">
                              <Icon icon={type?.icon || "mdi:wallet-outline"} className={`text-${type?.color} text-sm`} />
                              <span className="font-medium">{type?.label}</span>
                           </span>
                        );
                     }}
                  >
                     {transactionTypes.map((type) => (
                        <SelectItem key={type.value}>
                           <div className="flex items-center gap-2">
                              <Icon icon={type.icon} className={`w-4 h-4 text-${type.color}`} />
                              {type.label}
                           </div>
                        </SelectItem>
                     ))}


                  </Select>

                  <Select
                     label="Account"
                     selectedKeys={filters.accountId ? [filters.accountId] : ['all']}
                     onSelectionChange={(keys) => {
                        const value = Array.from(keys)[0] as string;
                        if (!value) {
                           setFilters(prev => ({ ...prev, accountId: 'all' }));
                           return;
                        }
                        handleAccountChange(value);
                     }}
                     size="sm"
                     className="w-full"
                  >
                     <SelectItem key="all">All Accounts</SelectItem>
                     {accounts.map((account) =>
                        <SelectItem key={account.id}>
                           {account.name}
                        </SelectItem>
                     )}
                  </Select>

                  <I18nProvider locale={typeof navigator !== 'undefined' ? navigator.language : 'en-US'}>
                     <DateRangePicker
                        label="Date Range"
                        value={selectedDateRange}
                        onChange={handleDateRangeChange}
                        size="sm"
                        className="w-full"
                        showMonthAndYearPickers
                        calendarProps={{
                           classNames: {
                              base: "bg-content1",
                              content: "text-foreground bg-content1"
                           }
                        }}
                     />
                  </I18nProvider>
               </div>

               {/* Quick Date Filters */}
               <div className="space-y-2">
                  <span className="text-small text-default-500">Quick filters:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                     <Button
                        onPress={() => applyDateRangePreset('week')}
                        size="sm"
                        variant="flat"
                        className="w-full"
                     >
                        Last Week
                     </Button>
                     <Button
                        onPress={() => applyDateRangePreset('month')}
                        size="sm"
                        variant="flat"
                        className="w-full"
                     >
                        Last Month
                     </Button>
                     <Button
                        onPress={() => applyDateRangePreset('year')}
                        size="sm"
                        variant="flat"
                        className="w-full"
                     >
                        Last Year
                     </Button>
                     <Button
                        onPress={clearDateRange}
                        color="danger"
                        variant="light"
                        size="sm"
                        className="w-full"
                        startContent={<Icon icon="mdi:close" className="w-3 h-3" />}
                     >
                        Clear
                     </Button>
                  </div>
               </div>

               {/* Active Filters Display */}
               {(filters.dateRange || filters.type !== 'all' || filters.search) && (
                  <div className="space-y-2 pt-2 border-t border-divider">
                     <span className="text-small text-default-500">Active filters:</span>
                     <div className="flex flex-wrap gap-2">
                        {filters.dateRange && (
                           <Chip
                              size="sm"
                              variant="flat"
                              color="primary"
                              onClose={clearDateRange}
                              className="max-w-full"
                           >
                              <span className="truncate">
                                 {formatDateRange(filters.dateRange.start, filters.dateRange.end)}
                              </span>
                           </Chip>
                        )}
                        {filters.type !== 'all' && (
                           <Chip
                              size="sm"
                              variant="flat"
                              color="secondary"
                              onClose={() => handleTypeChange('all')}
                           >
                              {filters.type === 'income' ? 'Income' : filters.type === 'expense' ? 'Expenses' : 'Transfers'}
                           </Chip>
                        )}
                        {filters.accountId && filters.accountId !== 'all' && (
                           <Chip
                              size="sm"
                              variant="flat"
                              color="warning"
                              onClose={() => handleAccountChange('all')}
                           >
                              Account: {accounts.find(a => a.id === filters.accountId)?.name || 'Unknown'}
                           </Chip>
                        )}
                        {filters.search && (
                           <Chip
                              size="sm"
                              variant="flat"
                              color="success"
                              onClose={() => {
                                 setSearchTerm('');
                                 setFilters(prev => ({ ...prev, search: undefined }));
                              }}
                              className="max-w-full"
                           >
                              <span className="truncate">
                                 Search: {filters.search}
                              </span>
                           </Chip>
                        )}
                     </div>
                  </div>
               )}
            </CardBody>
         </Card>

         {error && (
            <Card className="mb-4" classNames={{
               base: "border-danger-200 bg-danger-50 dark:border-danger-800 dark:bg-danger-900/20"
            }}>
               <CardBody>
                  <p className="text-danger-600 dark:text-danger-400">{error}</p>
               </CardBody>
            </Card>
         )}

         {transactions.length === 0 && !loading ? (
            <Card>
               <CardBody>
                  <div className="text-center py-8">
                     <p className="text-default-500">No transactions found</p>
                  </div>
               </CardBody>
            </Card>
         ) : (
            <div className="space-y-3 sm:space-y-6">
               {dateKeys.map(dateKey => {
                  const dayTransactions = groupedTransactions[dateKey];
                  const dayTotal = calculateDayTotal(dayTransactions);

                  return (
                     <Card key={dateKey} className="w-full">
                        <CardHeader className="flex justify-between items-center py-3 sm:py-4 px-4 sm:px-6">
                           <h2 className="text-base sm:text-lg font-semibold text-foreground">
                              {formatDateHeader(dateKey)}
                           </h2>
                           <div className="flex items-center gap-2">
                              <span
                                 className={`font-semibold text-sm sm:text-base px-2 py-1 rounded-full ${dayTotal >= 0
                                    ? 'text-success bg-success/10 border border-success/20'
                                    : 'text-danger bg-danger/10 border border-danger/20'
                                    }`}
                              >
                                 {dayTotal >= 0 ? '+' : ''}
                                 {formatAmount(dayTotal, dayTransactions[0]?.currency || 'USD')}
                              </span>
                           </div>
                        </CardHeader>
                        <Divider className="dark:bg-default-700" />
                        <CardBody className="gap-2 sm:gap-3 p-2 sm:p-4">
                           {dayTransactions.map((transaction) => {
                              const isAutoTransaction = transaction.provider === 'gocardless';

                              return (
                                 <Card
                                    key={transaction.id}
                                    className={clsx(
                                       "transition-all duration-200 hover:border-primary/40 hover:bg-content2",
                                       !transaction.category && "border-warning-200 bg-warning-50/50 dark:border-warning-800 dark:bg-warning-900/10",
                                       "border-default-200 dark:border-default-700 bg-content1 border"
                                    )}
                                    shadow="none"
                                    isPressable
                                 >
                                    <CardBody className="p-3 sm:p-4">
                                       <div className="flex justify-between items-start gap-3 sm:gap-4">
                                          <div className="flex items-start gap-3 flex-1 min-w-0">
                                             <div className="relative">
                                                <Avatar
                                                   size="sm"
                                                   className="flex-shrink-0 shadow-sm"
                                                   classNames={{
                                                      base: transaction.category
                                                         ? ""
                                                         : "bg-default-200 dark:bg-default-700 border-2 border-default-300 dark:border-default-600"
                                                   }}
                                                   style={transaction.category ? {
                                                      backgroundColor: transaction.category.color
                                                   } : {}}
                                                   icon={
                                                      transaction.category ? (
                                                         <Icon
                                                            icon={transaction.category.icon}
                                                            className="w-4 h-4 text-white drop-shadow-sm"
                                                         />
                                                      ) : (
                                                         <Icon
                                                            icon="mdi:help"
                                                            className="w-4 h-4 text-default-600 dark:text-default-400"
                                                         />
                                                      )
                                                   }
                                                />
                                                {isAutoTransaction && (
                                                   <div
                                                      className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center shadow-sm"
                                                      title="Auto transaction from linked account"
                                                   >
                                                      <Icon
                                                         icon="mdi:link"
                                                         className="text-white w-2.5 h-2.5"
                                                      />
                                                   </div>
                                                )}
                                             </div>
                                             <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                   <div className="flex-1 min-w-0">
                                                      <h3 className="font-semibold text-foreground text-sm sm:text-base truncate leading-tight">
                                                         {transaction.merchantName || transaction.description || 'Transaction'}
                                                      </h3>
                                                      <p className="text-xs sm:text-sm text-default-500 truncate mt-0.5">
                                                         {transaction.account.name}
                                                      </p>
                                                   </div>
                                                   <div className="text-right flex-shrink-0 sm:hidden">
                                                      <span
                                                         className={`font-bold text-sm ${transaction.amount >= 0
                                                            ? 'text-success'
                                                            : 'text-danger'
                                                            }`}
                                                      >
                                                         {transaction.amount >= 0 ? '+' : ''}
                                                         {formatAmount(transaction.amount, transaction.currency)}
                                                      </span>
                                                      <p className="text-xs text-default-400 mt-0.5">
                                                         {formatExactDate(transaction.date)}
                                                      </p>
                                                   </div>
                                                </div>

                                                <div className="flex items-center justify-between gap-2 sm:hidden">
                                                   {transaction.category ? (
                                                      <Chip
                                                         size="sm"
                                                         variant="flat"
                                                         style={{
                                                            backgroundColor: `${transaction.category.color}15`,
                                                            color: transaction.category.color,
                                                            borderColor: `${transaction.category.color}30`
                                                         }}
                                                         className="border text-xs font-medium"
                                                      >
                                                         <div className="flex items-center gap-1.5">
                                                            <span
                                                               className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                               style={{ backgroundColor: transaction.category.color }}
                                                            />
                                                            {transaction.category.name}
                                                         </div>
                                                      </Chip>
                                                   ) : (
                                                      <Chip
                                                         size="sm"
                                                         variant="flat"
                                                         color="warning"
                                                         className="text-xs"
                                                      >
                                                         Uncategorized
                                                      </Chip>
                                                   )}
                                                </div>

                                                <div className="hidden sm:flex items-center justify-between gap-3 mt-2">
                                                   <div className="flex items-center gap-2">
                                                      {transaction.category ? (
                                                         <Chip
                                                            size="sm"
                                                            variant="flat"
                                                            style={{
                                                               backgroundColor: `${transaction.category.color}15`,
                                                               color: transaction.category.color,
                                                               borderColor: `${transaction.category.color}30`
                                                            }}
                                                            className="border text-xs font-medium"
                                                         >
                                                            <div className="flex items-center gap-1.5">
                                                               <span
                                                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                                                  style={{ backgroundColor: transaction.category.color }}
                                                               />
                                                               {transaction.category.name}
                                                            </div>
                                                         </Chip>
                                                      ) : (
                                                         <Chip
                                                            size="sm"
                                                            variant="flat"
                                                            color="warning"
                                                            className="text-xs"
                                                         >
                                                            Uncategorized
                                                         </Chip>
                                                      )}
                                                   </div>
                                                   <span className="text-xs text-default-400">
                                                      {formatExactDate(transaction.date)}
                                                   </span>
                                                </div>
                                             </div>
                                          </div>

                                          <div className="text-right flex-shrink-0 hidden sm:block">
                                             <span
                                                className={`font-bold text-base ${transaction.amount >= 0
                                                   ? 'text-success'
                                                   : 'text-danger'
                                                   }`}
                                             >
                                                {transaction.amount >= 0 ? '+' : ''}
                                                {formatAmount(transaction.amount, transaction.currency)}
                                             </span>
                                          </div>
                                       </div>
                                    </CardBody>
                                 </Card>
                              );
                           })}
                        </CardBody>
                     </Card>
                  );
               })}

               {pagination.hasMore && (
                  <div className="flex justify-center pt-4">
                     <Button
                        onPress={loadMore}
                        isLoading={loading}
                        color="primary"
                        variant="flat"
                        size="md"
                        className="w-full sm:w-auto"
                     >
                        {loading ? 'Loading...' : 'Load More'}
                     </Button>
                  </div>
               )}
            </div>
         )}

         {loading && transactions.length === 0 && (
            <Card>
               <CardBody>
                  <div className="text-center py-8">
                     <Spinner size="lg" color="primary" />
                     <p className="mt-4 text-default-500">Loading transactions...</p>
                  </div>
               </CardBody>
            </Card>
         )}

         {transactions.length > 0 && (
            <Card className="mt-4 sm:mt-6">
               <CardBody className="py-2 sm:py-4">
                  <p className="text-xs sm:text-sm text-default-500 text-center">
                     Showing {transactions.length} of {pagination.totalCount} transactions
                  </p>
               </CardBody>
            </Card>
         )}

         {/* Add Transaction Drawer */}
         <Drawer
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            size="lg"
            placement="right"
            isDismissable={true}
            isKeyboardDismissDisabled={false}
         >
            <DrawerContent>
               {(onClose) => (
                  <>
                     <DrawerHeader className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                           <Icon icon="mdi:plus-circle" className="w-6 h-6 text-primary" />
                           <h2 className="text-xl font-bold">Add New Transaction</h2>
                        </div>
                     </DrawerHeader>
                     <DrawerBody className="pb-6">
                        <AddTransaction
                           onSuccess={() => {
                              onClose();
                              // Refresh transactions
                              fetchTransactions(0, 20, filters);
                           }}
                        />
                     </DrawerBody>
                  </>
               )}
            </DrawerContent>
         </Drawer>
      </div>
   );
}