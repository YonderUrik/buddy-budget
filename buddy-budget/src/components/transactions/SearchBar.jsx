import { Search, Filter, X, Calendar, ArrowDownUp, ArrowDown, ArrowUp, RefreshCw, Check } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTransactions } from "@/providers/transactions-provider";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose } from "@/components/ui/dialog";
import { useCategories } from "@/providers/categories-provider";
import { useAccounts } from "@/providers/accounts-provider";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { getIconComponent } from "@/app/dashboard/transactions/page";
import { accountIcons, categoryIcons } from "@/lib/config";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function SearchBar() {
  const { t } = useTranslation();
  const {
    searchTerm,
    setSearchTerm,
    filters,
    setFilters,
    clearFilters,
    page,
    setPage,
    isLoading,
  } = useTransactions();
  const { categories } = useCategories();
  const { accounts } = useAccounts();
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(searchTerm);
  const [dateRange, setDateRange] = useState({
    from: filters.dateFrom,
    to: filters.dateTo,
  });
  const [activeFiltersCount, setActiveFiltersCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const searchInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState("type");

  // Check if device is mobile
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    // Initial check
    checkIfMobile();
    
    // Add event listener for window resize
    window.addEventListener('resize', checkIfMobile);
    
    // Cleanup event listener
    return () => window.removeEventListener('resize', checkIfMobile);
  }, []);

  // Income and expense categories
  const incomeCategories = categories.filter(c => c.type === 'income').sort((a, b) => a.name.localeCompare(b.name));
  const expenseCategories = categories.filter(c => c.type === 'expense').sort((a, b) => a.name.localeCompare(b.name));

  // Count active filters for badge
  useEffect(() => {
    let count = 0;
    if (searchTerm) count++;
    if (filters.dateFrom || filters.dateTo) count++;
    if (filters.type.length) count++;
    if (filters.categoryId.length) count++;
    if (filters.sourceAccountId.length) count++;
    setActiveFiltersCount(count);
  }, [searchTerm, filters]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchTerm(searchValue);
    setPage(1);
  };

  const handleDateRangeApply = () => {
    // Fix the date range to handle UTC issues by setting times to beginning/end of day
    let fromDate = null;
    let toDate = null;
    
    if (dateRange.from) {
      // Set to beginning of day in UTC (00:00:00)
      fromDate = new Date(dateRange.from);
      fromDate.setUTCHours(0, 0, 0, 0);
    }
    
    if (dateRange.to) {
      // Set to end of day in UTC (23:59:59.999)
      toDate = new Date(dateRange.to);
      toDate.setUTCHours(23, 59, 59, 999);
    }
    
    setFilters({
      ...filters,
      dateFrom: fromDate,
      dateTo: toDate,
    });
    setPage(1);
  };

  const handleResetFilters = () => {
    clearFilters();
    setSearchValue("");
    setDateRange({ from: null, to: null });
    setPage(1);
    setIsFiltersOpen(false);
  };

  const updateTypeFilter = (type) => {
    setFilters({
      ...filters,
      type: filters.type.includes(type)
        ? filters.type.filter(t => t !== type)
        : [...filters.type, type]
    });
    setPage(1);
  };

  const updateCategoryFilter = (categoryId) => {
    setFilters({
      ...filters,
      categoryId: filters.categoryId.includes(categoryId)
        ? filters.categoryId.filter(id => id !== categoryId)
        : [...filters.categoryId, categoryId]
    });
    setPage(1);
  };

  const updateAccountFilter = (accountId) => {
    setFilters({
      ...filters,
      sourceAccountId: filters.sourceAccountId.includes(accountId)
        ? filters.sourceAccountId.filter(id => id !== accountId)
        : [...filters.sourceAccountId, accountId]
    });
    setPage(1);
  };

  // Create a summary of active filters for display
  const getFilterSummary = () => {
    const summary = [];
    
    // Add transaction types
    if (filters.type.length > 0) {
      summary.push(
        <Badge key="type" variant="outline" className="flex items-center gap-1 text-xs">
          <span className="font-semibold">{t("transactions.types")}:</span> 
          {filters.type.map(type => t(`transactions.types.${type}`)).join(', ')}
        </Badge>
      );
    }
    
    // Add date range
    if (filters.dateFrom || filters.dateTo) {
      let dateText = "";
      if (filters.dateFrom && filters.dateTo) {
        dateText = `${format(filters.dateFrom, "PP")} - ${format(filters.dateTo, "PP")}`;
      } else if (filters.dateFrom) {
        dateText = `${format(filters.dateFrom, "PP")} →`;
      } else if (filters.dateTo) {
        dateText = `← ${format(filters.dateTo, "PP")}`;
      }
      
      summary.push(
        <Badge key="date" variant="outline" className="flex items-center gap-1 text-xs">
          <span className="font-semibold">{t("transactions.date")}:</span> {dateText}
        </Badge>
      );
    }
    
    // Add categories
    if (filters.categoryId.length > 0) {
      const categoryNames = filters.categoryId
        .map(id => categories.find(c => c.id === id)?.name)
        .filter(Boolean);
      
      if (categoryNames.length > 2) {
        summary.push(
          <Badge key="category" variant="outline" className="flex items-center gap-1 text-xs">
            <span className="font-semibold">{t("transactions.category")}:</span> 
            {categoryNames.length} {t("transactions.categories")}
          </Badge>
        );
      } else {
        summary.push(
          <Badge key="category" variant="outline" className="flex items-center gap-1 text-xs">
            <span className="font-semibold">{t("transactions.category")}:</span> 
            {categoryNames.join(', ')}
          </Badge>
        );
      }
    }
    
    // Add accounts
    if (filters.sourceAccountId.length > 0) {
      const accountNames = filters.sourceAccountId
        .map(id => accounts.find(a => a.id === id)?.name)
        .filter(Boolean);
      
      if (accountNames.length > 2) {
        summary.push(
          <Badge key="account" variant="outline" className="flex items-center gap-1 text-xs">
            <span className="font-semibold">{t("transactions.account")}:</span> 
            {accountNames.length} {t("common.accounts")}
          </Badge>
        );
      } else {
        summary.push(
          <Badge key="account" variant="outline" className="flex items-center gap-1 text-xs">
            <span className="font-semibold">{t("transactions.account")}:</span> 
            {accountNames.join(', ')}
          </Badge>
        );
      }
    }
    
    return summary;
  };

  // Filter content component that will be used in both Dialog and Drawer
  const FilterContent = () => (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex w-full justify-between h-auto p-0 bg-transparent border-b rounded-none">
          <TabsTrigger 
            value="type" 
            className="flex-1 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-none transition-all"
          >
            {t("transactions.filterByType")}
          </TabsTrigger>
          <TabsTrigger 
            value="date" 
            className="flex-1 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-none transition-all"
          >
            {t("transactions.filterByDate")}
          </TabsTrigger>
          <TabsTrigger 
            value="categories" 
            className="flex-1 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-none transition-all"
          >
            {t("common.categories")}
          </TabsTrigger>
          <TabsTrigger 
            value="accounts" 
            className="flex-1 py-3 text-sm font-medium rounded-none border-b-2 border-transparent data-[state=active]:border-blue-500 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-none transition-all"
          >
            {t("common.accounts")}
          </TabsTrigger>
        </TabsList>
        
        <div className="p-4 h-[55vh] overflow-y-auto">
          <TabsContent value="type" className="m-0 py-4">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div 
                  className={cn(
                    "relative border rounded-xl p-4 cursor-pointer transition-all duration-200 overflow-hidden",
                    filters.type.includes("income") 
                      ? "border-green-500 ring-2 ring-green-500/20 bg-green-50/50 dark:bg-green-950/20" 
                      : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-800 hover:bg-green-50/30 dark:hover:bg-green-950/10"
                  )}
                  onClick={() => updateTypeFilter("income")}
                >
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2 text-center">
                    <div className={cn(
                      "p-2 rounded-full",
                      filters.type.includes("income") 
                        ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400" 
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    )}>
                      <ArrowDown className="h-6 w-6" />
                    </div>
                    <span className={cn(
                      "font-medium",
                      filters.type.includes("income") 
                        ? "text-green-700 dark:text-green-400" 
                        : "text-gray-700 dark:text-gray-300"
                    )}>
                      {t("transactions.types.income")}
                    </span>
                  </div>
                  {filters.type.includes("income") && (
                    <div className="absolute top-1 right-1">
                      <div className="bg-green-500 text-white p-1 rounded-full">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div 
                  className={cn(
                    "relative border rounded-xl p-4 cursor-pointer transition-all duration-200 overflow-hidden",
                    filters.type.includes("expense") 
                      ? "border-red-500 ring-2 ring-red-500/20 bg-red-50/50 dark:bg-red-950/20" 
                      : "border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-800 hover:bg-red-50/30 dark:hover:bg-red-950/10"
                  )}
                  onClick={() => updateTypeFilter("expense")}
                >
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2 text-center">
                    <div className={cn(
                      "p-2 rounded-full",
                      filters.type.includes("expense") 
                        ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400" 
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    )}>
                      <ArrowUp className="h-6 w-6" />
                    </div>
                    <span className={cn(
                      "font-medium",
                      filters.type.includes("expense") 
                        ? "text-red-700 dark:text-red-400" 
                        : "text-gray-700 dark:text-gray-300"
                    )}>
                      {t("transactions.types.expense")}
                    </span>
                  </div>
                  {filters.type.includes("expense") && (
                    <div className="absolute top-1 right-1">
                      <div className="bg-red-500 text-white p-1 rounded-full">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div 
                  className={cn(
                    "relative border rounded-xl p-4 cursor-pointer transition-all duration-200 overflow-hidden",
                    filters.type.includes("transfer") 
                      ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-950/20" 
                      : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-800 hover:bg-blue-50/30 dark:hover:bg-blue-950/10"
                  )}
                  onClick={() => updateTypeFilter("transfer")}
                >
                  <div className="relative z-10 flex flex-col items-center justify-center gap-2 text-center">
                    <div className={cn(
                      "p-2 rounded-full",
                      filters.type.includes("transfer") 
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" 
                        : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                    )}>
                      <ArrowDownUp className="h-6 w-6" />
                    </div>
                    <span className={cn(
                      "font-medium",
                      filters.type.includes("transfer") 
                        ? "text-blue-700 dark:text-blue-400" 
                        : "text-gray-700 dark:text-gray-300"
                    )}>
                      {t("transactions.types.transfer")}
                    </span>
                  </div>
                  {filters.type.includes("transfer") && (
                    <div className="absolute top-1 right-1">
                      <div className="bg-blue-500 text-white p-1 rounded-full">
                        <Check className="h-3 w-3" />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="date" className="m-0 py-4">
            <div className="space-y-4">
              <div className="border rounded-xl p-4 bg-card shadow-sm">
                <CalendarComponent
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  className="w-full"
                  numberOfMonths={1}
                  classNames={{
                    day_selected: "bg-blue-500 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                    day_range_middle: "bg-blue-100 text-blue-900 dark:bg-blue-800/30 dark:text-blue-50",
                    day_range_end: "bg-blue-500 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                    day_range_start: "bg-blue-500 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
                  }}
                />
                
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 mt-4 pt-4 border-t">
                  <div className="text-sm bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-md">
                    {dateRange.from && dateRange.to ? (
                      <>
                        {format(dateRange.from, "PP")} - {format(dateRange.to, "PP")}
                      </>
                    ) : dateRange.from ? (
                      <>{format(dateRange.from, "PP")} - </>
                    ) : dateRange.to ? (
                      <> - {format(dateRange.to, "PP")}</>
                    ) : (
                      <span className="text-gray-500">{t("transactions.selectDateRange")}</span>
                    )}
                  </div>
                  <Button 
                    onClick={handleDateRangeApply}
                    disabled={!dateRange.from && !dateRange.to}
                    className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {t("common.apply")}
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="categories" className="m-0 py-4">
            <div className="space-y-6">
              <Accordion type="single" collapsible defaultValue="expense" className="w-full">
                <AccordionItem value="expense" className="border-0 mb-4">
                  <AccordionTrigger className="text-base font-medium px-4 py-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg hover:no-underline">
                    {t("common.expenseCategories")}
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 px-1">
                    <div className="space-y-2">
                      {expenseCategories.map((category) => (
                        <div 
                          key={category.id} 
                          className={cn(
                            "flex items-center p-3 border rounded-lg transition-colors",
                            filters.categoryId.includes(category.id) 
                              ? `bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800` 
                              : "hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
                          )}
                          onClick={() => updateCategoryFilter(category.id)}
                        >
                          <div className="flex justify-between items-center w-full cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: category.color + "20", color: category.color }}
                              >
                                {getIconComponent(categoryIcons, category.icon)}
                              </div>
                              <span className="font-medium">{category.name}</span>
                            </div>
                            
                            <div>
                              {filters.categoryId.includes(category.id) ? (
                                <div className="bg-red-500 text-white p-1 rounded-full">
                                  <Check className="h-3 w-3" />
                                </div>
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
                
                <AccordionItem value="income" className="border-0">
                  <AccordionTrigger className="text-base font-medium px-4 py-3 bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400 rounded-lg hover:no-underline">
                    {t("common.incomeCategories")}
                  </AccordionTrigger>
                  <AccordionContent className="pt-3 px-1">
                    <div className="space-y-2">
                      {incomeCategories.map((category) => (
                        <div 
                          key={category.id} 
                          className={cn(
                            "flex items-center p-3 border rounded-lg transition-colors",
                            filters.categoryId.includes(category.id) 
                              ? `bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800` 
                              : "hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
                          )}
                          onClick={() => updateCategoryFilter(category.id)}
                        >
                          <div className="flex justify-between items-center w-full cursor-pointer">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center"
                                style={{ backgroundColor: category.color + "20", color: category.color }}
                              >
                                {getIconComponent(categoryIcons, category.icon)}
                              </div>
                              <span className="font-medium">{category.name}</span>
                            </div>
                            
                            <div>
                              {filters.categoryId.includes(category.id) ? (
                                <div className="bg-green-500 text-white p-1 rounded-full">
                                  <Check className="h-3 w-3" />
                                </div>
                              ) : (
                                <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>
          
          <TabsContent value="accounts" className="m-0 py-4">
            <div className="space-y-2">
              {accounts
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((account) => (
                  <div 
                    key={account.id} 
                    className={cn(
                      "flex items-center p-3 border rounded-lg transition-colors",
                      filters.sourceAccountId.includes(account.id) 
                        ? `bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800` 
                        : "hover:bg-gray-50 dark:hover:bg-gray-800 border-gray-200 dark:border-gray-700"
                    )}
                    onClick={() => updateAccountFilter(account.id)}
                  >
                    <div className="flex justify-between items-center w-full cursor-pointer">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: account.color + "20", color: account.color }}
                        >
                          {getIconComponent(accountIcons, account.icon)}
                        </div>
                        <span className="font-medium">{account.name}</span>
                      </div>
                      
                      <div>
                        {filters.sourceAccountId.includes(account.id) ? (
                          <div className="bg-blue-500 text-white p-1 rounded-full">
                            <Check className="h-3 w-3" />
                          </div>
                        ) : (
                          <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600"></div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </TabsContent>
        </div>
      </Tabs>
    </>
  );

  return (
    <div className="space-y-3 mb-4">
      <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                setSearchTerm("");
                setPage(1);
                searchInputRef.current?.focus();
              }}
              className="absolute inset-y-0 right-12 flex items-center"
            >
              <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
          <Input
            ref={searchInputRef}
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder={t("transactions.searchPlaceholder")}
            className="block w-full pl-10 pr-16 py-2 rounded-md leading-5 bg-white dark:bg-gray-900 placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="absolute inset-y-0 right-0 pr-3 flex items-center"
          >
            {isLoading ? (
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
            ) : (
              <Search className="h-5 w-5 text-blue-600 hover:text-blue-800" />
            )}
          </button>
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          {isMobile ? (
            <Drawer open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <DrawerTrigger asChild>
                <Button variant="outline" className="relative">
                  <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
                  {t("transactions.filter")}
                  {activeFiltersCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent className="px-0 sm:max-w-md mx-auto rounded-t-xl">
                <DrawerHeader className="border-b px-4 py-3 bg-gray-50 dark:bg-gray-800">
                  <DrawerTitle className="text-center text-lg font-medium text-gray-800 dark:text-gray-200">
                    {t("transactions.filter")}
                  </DrawerTitle>
                </DrawerHeader>
                
                <FilterContent />
                
                <DrawerFooter className="border-t flex flex-row justify-end gap-2 px-4 py-4 bg-gray-50 dark:bg-gray-800">
                  <Button 
                    variant="outline" 
                    onClick={handleResetFilters}
                  >
                    {t("transactions.clearFilters")}
                  </Button>
                  <DrawerClose asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">{t("common.apply")}</Button>
                  </DrawerClose>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : (
            <Dialog open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="relative">
                  <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
                  {t("transactions.filter")}
                  {activeFiltersCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 text-xs"
                    >
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[80vw] md:max-w-[600px] p-0">
                <DialogHeader className="border-b px-6 py-3 bg-gray-50 dark:bg-gray-800">
                  <DialogTitle className="text-center text-lg font-medium text-gray-800 dark:text-gray-200">
                    {t("transactions.filter")}
                  </DialogTitle>
                </DialogHeader>
                
                <div className="w-full">
                  <FilterContent />
                </div>
                
                <DialogFooter className="border-t px-6 py-4 bg-gray-50 dark:bg-gray-800 flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={handleResetFilters}
                  >
                    {t("transactions.clearFilters")}
                  </Button>
                  <DialogClose asChild>
                    <Button className="bg-blue-600 hover:bg-blue-700 text-white">{t("common.apply")}</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>
      
      {/* Active filters display */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {searchTerm && (
            <Badge variant="outline" className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
              <span className="font-semibold">{t("transactions.searchTerm")}:</span> {searchTerm}
              <button 
                onClick={() => {
                  setSearchTerm("");
                  setSearchValue("");
                  setPage(1);
                }}
                className="ml-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          
          {getFilterSummary().map((badge, index) => (
            <div key={index} className="flex items-center">
              {badge}
            </div>
          ))}
          
          {activeFiltersCount > 1 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleResetFilters}
              className="h-7 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/20"
            >
              {t("transactions.clearFilters")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
} 