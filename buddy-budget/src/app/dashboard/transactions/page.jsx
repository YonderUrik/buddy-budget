"use client"

import SearchBar from "@/components/transactions/SearchBar";
import TransactionTable from "@/components/transactions/TransactionTable";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { CalendarIcon, Check, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAccounts } from "@/providers/accounts-provider";
import { useCategories } from "@/providers/categories-provider";
import dayjs from "dayjs";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { accountIcons, categoryIcons, getCurrencySymbol } from "@/lib/config";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTransactions } from "@/providers/transactions-provider";
import { useWealth } from "@/providers/wealth-provider";

export const getIconComponent = (sourceList, iconName) => {
   const icon = sourceList.find((i) => i.value === iconName)
   return icon ? icon.icon : <Wallet className="h-5 w-5" />
}

const transactionSchema = z.object({
   date: z.any().refine(date => date, { message: "transactions.validation.dateRequired" }),
   description: z.string().nonempty({ message: "transactions.validation.descriptionRequired" }),
   amount: z.preprocess(
      (val) => (val === "" || val === null || val === undefined) ? null : parseFloat(String(val).replace(",", ".")),
      z.number({ invalid_type_error: "transactions.validation.amountNumber" }).positive({ message: "transactions.validation.amountPositive" })
   ),
   type: z.enum(["income", "expense", "transfer"]),
   categoryId: z.string().optional(),
   sourceAccountId: z.string().nonempty({ message: "transactions.validation.accountRequired" }),
   destinationAccountId: z.string().optional(),
}).superRefine((data, ctx) => {
   if (data.type === "transfer") {
      if (!data.destinationAccountId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["destinationAccountId"],
            message: "transactions.validation.destinationAccountRequired",
         });
      }
      if (data.sourceAccountId && data.destinationAccountId && data.sourceAccountId === data.destinationAccountId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["destinationAccountId"],
            message: "transactions.validation.accountsCannotBeSame",
         });
      }
   } else { // income or expense
      if (!data.categoryId) {
         ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["categoryId"],
            message: "transactions.validation.categoryRequired",
         });
      }
   }
});

export default function TransactionsPage() {

   const { t } = useTranslation()
   const [isDrawerOpen, setIsDrawerOpen] = useState(false)
   const [drawerDirection, setDrawerDirection] = useState("bottom")
   const [isSubmitting, setIsSubmitting] = useState(false)
   const { transactions, createTransaction, totalDays, totalPages, daysOnThisPage } = useTransactions();
   const { refreshWealthSnapshots } = useWealth();

   const {
      register,
      handleSubmit: formHandleSubmit,
      control,
      watch,
      setValue,
      reset,
      formState: { errors, isSubmitting: formIsSubmitting },
   } = useForm({
      resolver: zodResolver(transactionSchema),
      defaultValues: {
         date: dayjs().toDate(),
         description: "",
         amount: "",
         type: "expense",
         categoryId: '',
         sourceAccountId: '',
         destinationAccountId: '',
      },
      mode: "onChange"
   });

   const transactionType = watch("type");

   const { accounts: providerAccounts } = useAccounts()
   const { categories: providerCategories } = useCategories()

   const activeCategories = providerCategories.filter((category) => category.type === transactionType);

   const onSubmit = async (data) => {
      setIsSubmitting(true);
      try {
         const response = await createTransaction(data);
         if (response) {
            toast.success(t("transactions.transactionAdded"));
            setIsDrawerOpen(false);
            refreshWealthSnapshots();
         } else {
            toast.error(t("errors.transactionFailed"));
         }
      } catch (error) {
         toast.error(t(error.response?.data?.message || error.response?.data?.error || "errors.transactionFailed"));
      }
      setIsSubmitting(false);
   }

   const openDrawerWithDefaults = (type = "expense") => {
      // Detect if device is mobile or desktop
      const isMobile = window.innerWidth < 768;
      setDrawerDirection(isMobile ? "bottom" : "right");
      
      reset({
         date: dayjs().toDate(),
         description: "",
         amount: "",
         type: type,
         categoryId: '',
         sourceAccountId: '',
         destinationAccountId: '',
      });
      setIsDrawerOpen(true);
   };

   const getColorByType = (type) => {
      switch (type) {
         case "income": return "bg-green-500 hover:bg-green-600 text-white";
         case "expense": return "bg-red-500 hover:bg-red-600 text-white";
         case "transfer": return "bg-blue-500 hover:bg-blue-600 text-white";
         default: return "";
      }
   };

   const getTypeLabel = (type) => {
      switch (type) {
         case "income": return t("transactions.types.income");
         case "expense": return t("transactions.types.expense");
         case "transfer": return t("transactions.types.transfer");
         default: return "";
      }
   };

   return (
      <div className="container mx-auto p-4 md:p-6">
         <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <h1 className="text-xl md:text-2xl font-bold text-blue-600 dark:text-blue-400">{t("sidebar.transactions")}</h1>
            <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} direction={drawerDirection}>
               <DrawerTrigger asChild>
                  <Button
                     className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-700 dark:hover:bg-blue-600 w-full md:w-auto"
                     onClick={() => openDrawerWithDefaults("expense")}
                  >
                     <Plus className="h-4 w-4 mr-2" /> {t("transactions.addTransaction")}
                  </Button>
               </DrawerTrigger>
               <DrawerContent className="px-4 pb-4">
                  <DrawerHeader className="border-b pb-4 mb-2">
                     <DrawerTitle className="text-xl font-bold">{t("transactions.addTransaction")}</DrawerTitle>
                     <DrawerDescription>{t("transactions.createNewTransaction")}</DrawerDescription>
                  </DrawerHeader>
                  
                  <form onSubmit={formHandleSubmit(onSubmit)} className="space-y-4 pt-2 overflow-y-auto max-h-[75vh]">
                     {/* Transaction Type Switcher */}
                     <div className="grid grid-cols-3 gap-2 mb-4">
                        {["income", "expense", "transfer"].map(type => (
                           <Button
                              key={type}
                              type="button"
                              variant={transactionType === type ? "default" : "outline"}
                              onClick={() => {
                                 setValue("type", type);
                                 if (type === "transfer") {
                                    setValue("categoryId", '', { shouldValidate: false });
                                    setValue("destinationAccountId", '', { shouldValidate: true });
                                 } else {
                                    setValue("categoryId", '', { shouldValidate: true });
                                    setValue("destinationAccountId", '', { shouldValidate: false });
                                 }
                              }}
                              className={cn(
                                 "relative h-12 flex flex-col items-center justify-center transition-all",
                                 transactionType === type ? getColorByType(type) : "hover:bg-gray-100 dark:hover:bg-gray-800"
                              )}
                           >
                              {transactionType === type && (
                                 <div className="absolute top-2 right-2">
                                    <Check className="h-3 w-3" />
                                 </div>
                              )}
                              {getTypeLabel(type)}
                           </Button>
                        ))}
                     </div>

                     <div className="space-y-4">
                        {/* Amount */}
                        <div className="space-y-2">
                           <Label htmlFor="transaction-amount" className="text-sm font-medium">
                              {t("transactions.amount")}
                           </Label>
                           <Input
                              id="transaction-amount"
                              type="text"
                              placeholder={t("transactions.amountPlaceholder")}
                              {...register("amount")}
                              className="text-lg py-5 focus-visible:ring-blue-500/50"
                              onChange={(e) => {
                                 const value = e.target.value;
                                 if (/^\d*([,\.]\d*)?$/.test(value) || value === "") {
                                    setValue("amount", value, { shouldValidate: true });
                                 }
                              }}
                           />
                           {errors.amount && <p className="text-red-500 text-xs">{t(errors.amount.message)}</p>}
                        </div>

                        {/* Description*/}
                        <div className="space-y-2">
                           <Label htmlFor="transaction-description" className="text-sm font-medium">
                              {t("transactions.description")}
                           </Label>
                           <Input
                              id="transaction-description"
                              placeholder={t("transactions.descriptionPlaceholder")}
                              {...register("description")}
                              className="focus-visible:ring-blue-500/50"
                           />
                           {errors.description && <p className="text-red-500 text-xs">{t(errors.description.message)}</p>}
                        </div>

                        {/* Date */}
                        <div className="space-y-2">
                           <Label htmlFor="transaction-date" className="text-sm font-medium">
                              {t("transactions.date")}
                           </Label>
                           <Controller
                              name="date"
                              control={control}
                              render={({ field }) => (
                                 <Popover>
                                    <PopoverTrigger asChild>
                                       <Button
                                          variant={"outline"}
                                          className={cn(
                                             "w-full justify-start text-left font-normal focus-visible:ring-blue-500/50",
                                             !field.value && "text-muted-foreground"
                                          )}
                                       >
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {field.value ? dayjs(field.value).format("DD/MM/YYYY") : <span>Pick a date</span>}
                                       </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                       <Calendar
                                          mode="single"
                                          selected={field.value ? dayjs(field.value).toDate() : null}
                                          onSelect={(date) => field.onChange(dayjs(date).toDate())}
                                          initialFocus
                                       />
                                    </PopoverContent>
                                 </Popover>
                              )}
                           />
                           {errors.date && <p className="text-red-500 text-xs">{t(errors.date.message)}</p>}
                        </div>

                        {/* Category - Show for income/expense */}
                        {transactionType !== "transfer" && (
                           <div className="space-y-2">
                              <Label htmlFor="transaction-category" className="text-sm font-medium">
                                 {t("transactions.category")}
                              </Label>
                              <Controller
                                 name="categoryId"
                                 control={control}
                                 render={({ field }) => (
                                    <Select
                                       id="transaction-category"
                                       value={field.value || ""}
                                       onValueChange={field.onChange}
                                    >
                                       <SelectTrigger id="transaction-category" className="focus-visible:ring-blue-500/50">
                                          <SelectValue placeholder={t("transactions.selectCategory")}>
                                             {field.value && activeCategories.find(c => c.id === field.value) ? (
                                                <div className="flex items-center gap-2">
                                                   <div
                                                      className="w-6 h-6 rounded-full flex items-center justify-center"
                                                      style={{
                                                         backgroundColor: activeCategories.find(c => c.id === field.value).color + "20",
                                                         color: activeCategories.find(c => c.id === field.value).color
                                                      }}
                                                   >
                                                      {getIconComponent(categoryIcons, activeCategories.find(c => c.id === field.value).icon)}
                                                   </div>
                                                   {activeCategories.find(c => c.id === field.value).name}
                                                </div>
                                             ) : (
                                                t("transactions.selectCategory")
                                             )}
                                          </SelectValue>
                                       </SelectTrigger>
                                       <SelectContent>
                                          {activeCategories.map((category) => (
                                             <SelectItem key={category.id} value={category.id}>
                                                <div className="flex items-center gap-2">
                                                   <div
                                                      className="w-6 h-6 rounded-full flex items-center justify-center"
                                                      style={{ backgroundColor: category.color + "20", color: category.color }}
                                                   >
                                                      {getIconComponent(categoryIcons, category.icon)}
                                                   </div>
                                                   {category.name}
                                                </div>
                                             </SelectItem>
                                          ))}
                                       </SelectContent>
                                    </Select>
                                 )}
                              />
                              {errors.categoryId && <p className="text-red-500 text-xs">{t(errors.categoryId.message)}</p>}
                           </div>
                        )}

                        {/* Source Account*/}
                        <div className="space-y-2">
                           <Label htmlFor="transaction-source-account" className="text-sm font-medium">
                              {transactionType === "transfer" ? t("transactions.sourceAccount") : t("transactions.account")}
                           </Label>
                           <Controller
                              name="sourceAccountId"
                              control={control}
                              render={({ field }) => (
                                 <Select
                                    id="transaction-source-account"
                                    value={field.value || ""}
                                    onValueChange={field.onChange}
                                 >
                                    <SelectTrigger id="transaction-source-account" className="focus-visible:ring-blue-500/50">
                                       <SelectValue placeholder={transactionType === "transfer" ? t("transactions.selectSourceAccount") : t("transactions.selectAccount")}>
                                          {field.value && providerAccounts.find(a => a.id === field.value) ? (
                                             <div className="flex items-center gap-2 w-full overflow-hidden">
                                                <div
                                                   className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                                                   style={{ backgroundColor: providerAccounts.find(a => a.id === field.value).color + "20", color: providerAccounts.find(a => a.id === field.value).color }}
                                                >
                                                   {getIconComponent(accountIcons, providerAccounts.find(a => a.id === field.value).icon)}
                                                </div>
                                                <span className="truncate flex-grow min-w-0">
                                                   {providerAccounts.find(a => a.id === field.value).name}
                                                </span>
                                                <span className="flex-shrink-0 ml-1">
                                                   ({getCurrencySymbol(providerAccounts.find(a => a.id === field.value).currency)})
                                                </span>
                                             </div>
                                          ) : (
                                             transactionType === "transfer" ? t("transactions.selectSourceAccount") : t("transactions.selectAccount")
                                          )}
                                       </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                       {providerAccounts
                                          .filter(account => transactionType !== "transfer" || account.id !== watch("destinationAccountId"))
                                          .map((account) => (
                                             <SelectItem key={account.id} value={account.id}>
                                                <div className="flex items-center gap-2">
                                                   <div
                                                      className="w-6 h-6 rounded-full flex items-center justify-center mr-2"
                                                      style={{ backgroundColor: account.color + "20", color: account.color }}
                                                   >
                                                      {getIconComponent(accountIcons, account.icon)}
                                                   </div>
                                                   {account.name} ({getCurrencySymbol(account.currency)})
                                                </div>
                                             </SelectItem>
                                          ))}
                                    </SelectContent>
                                 </Select>
                              )}
                           />
                           {errors.sourceAccountId && <p className="text-red-500 text-xs">{t(errors.sourceAccountId.message)}</p>}
                        </div>

                        {/* Destination Account - Show for transfer */}
                        {transactionType === "transfer" && (
                           <div className="space-y-2">
                              <Label htmlFor="transaction-destination-account" className="text-sm font-medium">
                                 {t("transactions.destinationAccount")}
                              </Label>
                              <Controller
                                 name="destinationAccountId"
                                 control={control}
                                 render={({ field }) => (
                                    <Select
                                       id="transaction-destination-account"
                                       value={field.value || ""}
                                       onValueChange={field.onChange}
                                    >
                                       <SelectTrigger id="transaction-destination-account" className="focus-visible:ring-blue-500/50">
                                          <SelectValue placeholder={t("transactions.selectDestinationAccount")}>
                                             {field.value && providerAccounts.find(a => a.id === field.value) ? (
                                                <div className="flex items-center gap-2 w-full overflow-hidden">
                                                   <div
                                                      className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center"
                                                      style={{ backgroundColor: providerAccounts.find(a => a.id === field.value).color + "20", color: providerAccounts.find(a => a.id === field.value).color }}
                                                   >
                                                      {getIconComponent(accountIcons, providerAccounts.find(a => a.id === field.value).icon)}
                                                   </div>
                                                   <span className="truncate flex-grow min-w-0">
                                                      {providerAccounts.find(a => a.id === field.value).name}
                                                   </span>
                                                   <span className="flex-shrink-0 ml-1">
                                                      ({getCurrencySymbol(providerAccounts.find(a => a.id === field.value).currency)})
                                                   </span>
                                                </div>
                                             ) : (
                                                t("transactions.selectDestinationAccount")
                                             )}
                                          </SelectValue>
                                       </SelectTrigger>
                                       <SelectContent>
                                          {providerAccounts
                                             .filter(account => account.id !== watch("sourceAccountId"))
                                             .map((account) => (
                                                <SelectItem key={account.id} value={account.id}>
                                                   <div className="flex items-center gap-2">
                                                      <div
                                                         className="w-6 h-6 rounded-full flex items-center justify-center mr-2"
                                                         style={{ backgroundColor: account.color + "20", color: account.color }}
                                                      >
                                                         {getIconComponent(accountIcons, account.icon)}
                                                      </div>
                                                      {account.name} ({getCurrencySymbol(account.currency)})
                                                   </div>
                                                </SelectItem>
                                             ))}
                                       </SelectContent>
                                    </Select>
                                 )}
                              />
                              {errors.destinationAccountId && <p className="text-red-500 text-xs">{t(errors.destinationAccountId.message)}</p>}
                           </div>
                        )}
                     </div>

                     <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-6 py-6 text-base bg-blue-600 hover:bg-blue-700 text-white"
                     >
                        {isSubmitting ? (
                           <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              {t("transactions.processing")}
                           </>
                        ) : (
                           <>{t("transactions.addTransaction")}</>
                        )}
                     </Button>
                  </form>
               </DrawerContent>
            </Drawer>
         </div>
         
         {/* Search and Filter Bar */}
         <SearchBar />
         
         <div className="rounded-lg bg-white dark:bg-gray-900 shadow overflow-hidden">
            <TransactionTable transactions={transactions} totalDays={totalDays} totalPages={totalPages} daysOnThisPage={daysOnThisPage} />
         </div>
      </div>
   );
}